"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = exports.Runner = exports.FileManager = exports.Bbox = exports.ProjectOpts = exports.BboxOpts = exports.commandMethod = exports.ListCommandParams = exports.ProxyBuildParams = exports.RunCommandParams = exports.ServiceCommandParams = exports.Runtime = exports.Command = void 0;
require("source-map-support/register");
require("reflect-metadata");
const globby = require("globby");
const shell = require("shelljs");
const process = require("process");
const lodash_1 = require("lodash");
const path_1 = require("path");
const fs = require("fs");
const pm2 = require("pm2");
const util_1 = require("util");
const jf = require("joiful");
const pretty_joi_1 = require("./pretty-joi");
const dockerCompose = require("docker-compose");
const yamljs_1 = require("yamljs");
const child_process_1 = require("child_process");
//import {ProxyConfig} from './proxy-server';
const YAML = require("yamljs");
var Command;
(function (Command) {
    Command["Build"] = "Build";
})(Command = exports.Command || (exports.Command = {}));
var Runtime;
(function (Runtime) {
    Runtime["Local"] = "Local";
    Runtime["DockerCompose"] = "DockerCompose";
})(Runtime = exports.Runtime || (exports.Runtime = {}));
class ServiceCommandParams {
}
__decorate([
    jf.array().required().items(joi => joi.string()).min(1).max(1),
    __metadata("design:type", Array)
], ServiceCommandParams.prototype, "services", void 0);
exports.ServiceCommandParams = ServiceCommandParams;
class RunCommandParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], RunCommandParams.prototype, "runnable", void 0);
exports.RunCommandParams = RunCommandParams;
class ProxyBuildParams {
}
__decorate([
    jf.string().allow(''),
    __metadata("design:type", String)
], ProxyBuildParams.prototype, "todo", void 0);
exports.ProxyBuildParams = ProxyBuildParams;
class ListCommandParams {
}
__decorate([
    jf.string().allow(''),
    __metadata("design:type", String)
], ListCommandParams.prototype, "mode", void 0);
exports.ListCommandParams = ListCommandParams;
function commandMethod(params = {}) {
    return function (target, propertyKey, descriptor) {
        const [methodParams, ctx] = Reflect.getMetadata('design:paramtypes', target, propertyKey);
        if (methodParams.name !== 'Object') {
            params.paramsType = methodParams;
        }
        const origMethod = descriptor.value;
        descriptor.value = function commandMethodParamsValidator() {
            //validate
            if (params.paramsType) {
                const val = jf.validateAsClass(arguments[0], params.paramsType);
                if (val.error) {
                    //TODO types
                    const error = val.error;
                    //val.error.name = 'TypeError';
                    const parsed = pretty_joi_1.PrettyJoi.parseError(error);
                    error.message = parsed.message;
                    throw error;
                }
                arguments[0] = val.value;
            }
            return origMethod.apply(this, arguments);
        };
    };
}
exports.commandMethod = commandMethod;
class BboxOpts {
}
exports.BboxOpts = BboxOpts;
class ProjectOpts {
}
exports.ProjectOpts = ProjectOpts;
class Bbox {
    constructor(opts, fileManager, runner, processManager) {
        this.opts = opts;
        this.fileManager = fileManager;
        this.runner = runner;
        this.processManager = processManager;
        this.projectOpts = {
            reverseProxy: {
                port: 8080
            },
            domain: 'local.app.garden',
            proxyConfigPath: `${this.opts.rootPath}/.bbox/proxy-config.json`,
            dockerComposeOverridePath: `${this.opts.rootPath}/.bbox/docker-compose.override.yml`
        };
    }
    async init() {
        const rootBboxPath = `${this.opts.rootPath}/.bbox`;
        if (!fs.existsSync(rootBboxPath)) {
            fs.mkdirSync(rootBboxPath);
        }
    }
    async test(params) {
        //const {module, service} = await this.getService(params.services[0]);
        //console.log(module, service); // XXX
        //await this.processManager.sendDataToService(module, service);
    }
    async proxyBuild(params) {
        const modules = await this.getAllModules();
        // reverse proxy server
        const forward = {};
        for (const module of modules) {
            for (const service of module.services) {
                if (!service.port) {
                    continue;
                }
                const origin = `${service.name}.${this.projectOpts.domain}`;
                const destination = `http://localhost:${service.port}`;
                forward[origin] = destination;
            }
        }
        const config = {
            port: this.projectOpts.reverseProxy.port,
            forward
        };
        fs.writeFileSync(this.projectOpts.proxyConfigPath, JSON.stringify(config, null, 2));
        // docker compose
        const dockerComposePath = `${this.opts.rootPath}/docker-compose.yml`;
        if (!fs.existsSync(dockerComposePath)) {
            throw new Error(`No ${dockerComposePath} exists`);
        }
        if (fs.existsSync(this.projectOpts.dockerComposeOverridePath)) {
            fs.unlinkSync(this.projectOpts.dockerComposeOverridePath);
        }
        const overwrite = { version: '3', services: {} };
        const services = [];
        const moduleNames = [];
        for (const module of modules) {
            if (!module.availableRuntimes.includes(Runtime.DockerCompose)) {
                continue;
            }
            moduleNames.push(module.name);
            for (const service of module.services) {
                if (!service.port) {
                    continue;
                }
                services.push({ name: service.name, domainName: `${service.name}.${this.projectOpts.domain}`, ip: '172.17.0.1' });
            }
        }
        const extra_hosts = services.map((service) => {
            return `${service.domainName}:${service.ip}`;
        });
        for (const moduleName of moduleNames) {
            overwrite.services[moduleName] = { extra_hosts };
        }
        const yaml = YAML.stringify(overwrite);
        fs.writeFileSync(this.projectOpts.dockerComposeOverridePath, yaml);
    }
    async proxyStart(params) {
    }
    async run(params) {
        const modules = await this.getAllModules();
        if (modules.length === 0) {
            throw new Error('No modules found');
        }
        if (modules.length > 1) {
            throw new Error('More modules found');
        }
        const module = modules[0];
        try {
            await this.runner.run(module, params.runnable, {});
        }
        catch (e) {
            console.error(e); // XXX
            throw e;
        }
    }
    async build(params) {
        const module = await this.getModule(params.services[0]);
        await this.runBuild(module, {});
    }
    async start(params) {
        const { module, service } = await this.getService(params.services[0]);
        const ctx = {};
        await this.runBuildIfNeeded(module, ctx);
        await this.runMigrationsIfNeeded(module, ctx);
        await this.runStart(module, params.services[0], ctx);
        await this.setProxyForwardForServiceIfNeeded(module, service);
    }
    async stop(params) {
        const { service, module } = await this.getService(params.services[0]);
        await this.processManager.stop(module, service);
        await this.unsetProxyForwardForServiceIfNeeded(module, service);
    }
    async migrate(params) {
        const module = await this.getModule(params.services[0]);
        await this.runMigrate(module, {});
    }
    async list(params) {
        const modules = await this.getAllModules();
        for (const module of modules) {
            for (const app of module.services) {
                console.log(`${app.name} [${module.name}] built: ${module.state.built}, pending migrations: ${this.getNotAppliedMigrations(module).join(', ')}, runtimes: ${module.availableRuntimes}`); // XXX
            }
        }
    }
    async shutdown() {
        await this.processManager.onShutdown();
    }
    async runStart(module, appName, ctx) {
        const app = module.services.find(app => app.name === appName);
        await this.runBuildIfNeeded(module, ctx);
        await this.runMigrationsIfNeeded(module, ctx);
        if (!app) {
            throw new Error(`App ${appName} not found`);
        }
        await this.processManager.start(module, app);
    }
    async runRestartApp(module, appName, ctx) {
        const app = module.services.find(app => app.name === appName);
        if (!app) {
            throw new Error(`App ${appName} not found`);
        }
        await this.processManager.restart(module, app);
    }
    async runBuild(module, ctx) {
        if (!module.build) {
            throw new Error('Module has not build action specified');
        }
        await this.runner.run(module, module.build, ctx);
        module.state.built = true;
        this.fileManager.saveState(module);
    }
    async runMigrate(module, ctx) {
        if (!module.migrations) {
            throw new Error('Module has not build action specified');
        }
        const diff = this.getNotAppliedMigrations(module);
        if (diff.length === 0) {
            console.log('> No new migrations'); // XXX
            return;
        }
        for (const migId of diff) {
            try {
                console.log(`> Migrating ${migId}`); // XXX
                await this.runner.run(module, module.migrations[migId], ctx);
                module.state.ranMigrations.push(migId);
                this.fileManager.saveState(module);
            }
            catch (e) {
                console.log(`> Migration ${migId} failed.`); // XXX
                throw e;
            }
        }
        console.log(`> All new migrations applied.`); // XXX
        return {};
    }
    async runBuildIfNeeded(module, ctx) {
        if (module.state.built || !module.build) {
            return;
        }
        await this.runBuild(module, ctx);
    }
    async runMigrationsIfNeeded(module, ctx) {
        const migrations = this.getNotAppliedMigrations(module);
        if (migrations.length === 0) {
            return;
        }
        await this.runMigrate(module, ctx);
    }
    getNotAppliedMigrations(module) {
        if (!module.migrations) {
            return [];
        }
        const migrationIds = Object.keys(module.migrations).sort();
        const diff = lodash_1.difference(migrationIds, module.state.ranMigrations);
        return diff;
    }
    async getModule(name) {
        const modules = await this.getAllModules();
        const module = modules.find((module) => module.name === name);
        if (!module) {
            throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
        }
        return module;
    }
    async getModuleForService(serviceName) {
        const modules = await this.getAllModules();
        const module = modules.find((module) => { var _a; return (_a = module.services.find(app => app.name === serviceName)) !== null && _a !== void 0 ? _a : false; });
        if (!module) {
            throw new Error(`Service "${serviceName}" not found. Discovered services: TODO`);
        }
        return module;
    }
    async getService(serviceName) {
        const modules = await this.getAllModules();
        for (const module of modules) {
            const service = module.services.find(app => app.name === serviceName);
            if (service) {
                return {
                    module,
                    service
                };
            }
        }
        throw new Error(`Service "${serviceName}" not found.`);
    }
    async getAllModules() {
        const modules = await this.fileManager.discoverModules(this.opts.rootPath);
        // Proxy module
        modules.push({
            name: 'proxy',
            absolutePath: __dirname,
            availableRuntimes: [Runtime.Local],
            runtime: Runtime.Local,
            state: { built: true, ranMigrations: [] },
            migrations: {},
            services: [{
                    name: 'proxy-http',
                    port: 80,
                    start: 'node proxy-server.js',
                    env: {
                        configFilePath: this.projectOpts.proxyConfigPath
                    }
                }, {
                    name: 'proxy-https',
                    port: 443,
                    start: 'node proxy-server.js',
                    env: {
                        configFilePath: this.projectOpts.proxyConfigPath
                    }
                }]
        });
        return modules;
    }
    setProxyForwardForServiceIfNeeded(module, service) {
    }
    unsetProxyForwardForServiceIfNeeded(module, service) {
        console.log(module, service); // XXX
    }
}
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "test", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ProxyBuildParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "proxyBuild", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ProxyBuildParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "proxyStart", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RunCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "run", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "build", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "start", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "stop", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "migrate", null);
__decorate([
    commandMethod(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListCommandParams]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "list", null);
exports.Bbox = Bbox;
class FileManager {
    discoverRootPath(path) {
        let rootPath = undefined;
        let currentPath = path;
        do {
            if (fs.existsSync(`${currentPath}/bbox.project.js`)) {
                rootPath = currentPath;
            }
            const newPath = path_1.dirname(currentPath);
            if (newPath === currentPath) {
                break;
            }
            currentPath = newPath;
        } while (!rootPath);
        if (!rootPath) {
            throw new Error('Could not find bbox.project.js');
        }
        return rootPath;
    }
    async discoverModules(path) {
        const paths = globby.sync([
            '*/bbox.config.js'
        ], {
            cwd: path,
            absolute: true,
            gitignore: true
        });
        const modules = [];
        for (const moduleFilePath of paths) {
            try {
                const absolutePath = path_1.dirname(moduleFilePath);
                const moduleFile = require(moduleFilePath);
                const stateFilePath = `${absolutePath}/bbox.state.json`;
                if (!fs.existsSync(stateFilePath)) {
                    fs.writeFileSync(stateFilePath, '{}');
                }
                const moduleStateFile = require(stateFilePath);
                // TODO types
                const state = Object.assign({
                    ranMigrations: [],
                    built: false
                }, moduleStateFile);
                // moduleFile.services = moduleFile.services.map<Service>((serviceFile) => {
                //   return Object.assign({
                //     env: {}
                //   }, serviceFile)
                // });
                const module = Object.assign({
                    absolutePath,
                    state,
                    availableRuntimes: [],
                    runtime: undefined
                }, moduleFile);
                // Services
                if (module.services) {
                    for (const service of module.services) {
                        if (!service.name) {
                            throw new Error(`No app name in ${moduleFilePath}`);
                        }
                        if (service.start && !module.availableRuntimes.includes(Runtime.Local)) {
                            module.availableRuntimes.push(Runtime.Local);
                        }
                    }
                }
                modules.push(module);
            }
            catch (e) {
                throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
            }
        }
        // @DockerCompose
        try {
            const dockerComposeServices = await dockerCompose.config({ cwd: path });
            const dockerComposeFile = yamljs_1.parse(dockerComposeServices.out);
            const services = Object.keys(dockerComposeFile.services);
            for (const serviceName of services) {
                const foundAppModule = modules.find((module) => module.name === serviceName);
                if (!foundAppModule) {
                    throw new Error(`Module not found: ${serviceName}`);
                }
                foundAppModule.availableRuntimes.push(Runtime.DockerCompose);
            }
        }
        catch (e) {
            if (e.err && e.err.includes('Can\'t find a suitable configuration file')) {
                console.log('No docker-compose configuration found'); // XXX
            }
            else {
                console.log('DockerComposer error', e); // XXX
            }
        }
        for (const module of modules) {
            if (module.availableRuntimes.length === 0) {
                throw new Error(`Module ${module} has no available runtime`);
            }
            if (!module.runtime) {
                module.runtime = module.availableRuntimes[0];
            }
        }
        console.log(JSON.stringify(modules, null, 2)); // XXX
        //const pluginServices = await this.runPlugins('discoverServices');
        //TODO do some magic to merge/select values from discovered plugin services
        //defaultsDeep(services, pluginServices);
        return modules;
    }
    saveState(module) {
        fs.writeFileSync(`${module.absolutePath}/bbox.state.json`, JSON.stringify(module.state, null, 2));
    }
}
exports.FileManager = FileManager;
class Runner {
    async run(module, runnable, ctx) {
        if (Array.isArray(runnable)) {
            for (const one of runnable) {
                await this.run(module, one, ctx);
            }
            return;
        }
        // Do we want to support inline functions?
        // if (typeof runnable === 'function') {
        //   await runnable({
        //     module,
        //     ctx
        //   });
        //   return;
        // }
        if (typeof runnable === 'string') {
            if (module.runtime === Runtime.DockerCompose) {
                await this.runDockerCompose(module, runnable, ctx);
                return;
            }
            this.runShellCmd(module.absolutePath, runnable);
            return;
        }
        throw new Error('Can not run ' + typeof runnable);
    }
    async runDockerCompose(module, cmd, ctx) {
        const args = [];
        // linux
        // const hostIp = '172.17.0.1';
        // args.push(`--add-host=xxx:${hostIp}`);
        this.spawn('docker-compose', ['run', '--rm', '--use-aliases', ...args, module.name, cmd], {});
    }
    runShellCmd(cwd, cmd) {
        this.shell.pushd(cwd);
        const opts = this.createExecOpts();
        opts.silent = false;
        console.log(`> Running: ${cmd}`); // XXX
        const ret = this.shell.exec(cmd, opts);
        if (ret.code !== 0) {
            throw new Error(`shell error: ${ret.stderr}`);
        }
        this.shell.popd();
    }
    spawn(cmd, args, opts) {
        //merge current process env with spawn cmd
        //const env = _.defaults({}, opts.env, process.env);
        const env = process.env;
        // const userGroup = this.getUserGroup();
        // if (userGroup) {
        //   env.BOX_USER = userGroup;
        // }
        const cmdString = `${cmd} ${args.join(' ')}`;
        console.log(cmdString); // XXX
        const ret = child_process_1.spawnSync(cmd, args, {
            env,
            shell: true,
            stdio: 'inherit'
        });
        if (ret.status !== 0) {
            console.error(ret); //XXX
            throw new Error('spawn error');
        }
    }
    createExecOpts() {
        const env = process.env;
        const opts = {
            //async: true //TODO
            silent: false,
            windowsHide: true,
            env
        };
        return opts;
    }
    get shell() {
        shell.config.reset();
        shell.config.silent = true;
        return shell;
    }
}
exports.Runner = Runner;
const pm2Connect = util_1.promisify(pm2.connect).bind(pm2);
const pm2Disconnect = util_1.promisify(pm2.disconnect).bind(pm2);
const pm2Start = util_1.promisify(pm2.start).bind(pm2);
const pm2Restart = util_1.promisify(pm2.restart).bind(pm2);
const pm2Stop = util_1.promisify(pm2.stop).bind(pm2);
const pm2List = util_1.promisify(pm2.list).bind(pm2);
const pm2SendDataToProcessId = util_1.promisify(pm2.sendDataToProcessId).bind(pm2);
class ProcessManager {
    async start(module, service) {
        var _a;
        await this.pm2Connect();
        if (module.runtime === Runtime.DockerCompose) {
            const args = [];
            // linux
            //const hostIp = '172.17.0.1';
            //args.push(`--add-host=xxx:${hostIp}`);
            if (service.port) {
                args.push(`-p ${service.port}:${(_a = service.containerPort) !== null && _a !== void 0 ? _a : service.port}`);
            }
            const runCmd = `run --rm ${args.join(' ')} ${module.name}`;
            console.log(runCmd); // XXX
            if (service.start) {
                await pm2Start({
                    name: service.name,
                    script: 'docker-compose',
                    args: `${runCmd} ${service.start}`
                });
            }
            else {
                await pm2Start({
                    name: service.name,
                    script: 'docker-compose',
                    args: runCmd
                });
            }
            return;
        }
        await pm2Start({
            name: service.name,
            cwd: module.absolutePath,
            script: service.start,
            env: service.env
        });
    }
    async sendDataToService(module, service) {
        await this.pm2Connect();
        const processList = await pm2List();
        const ret = await pm2SendDataToProcessId(0, {
            id: 0,
            type: 'message',
            data: {
                some: 'data',
                hello: true
            },
            topic: 'some topic'
        });
        console.log(ret); // XXX
    }
    async onShutdown() {
        return this.pm2Disconnect();
    }
    async restart(module, service) {
        await this.pm2Connect();
        await pm2Restart(service.start);
    }
    async stop(module, service) {
        await this.pm2Connect();
        try {
            await pm2Stop(service.name);
        }
        catch (e) {
            throw new Error(`PM2 error: ${e.message}`);
        }
    }
    async pm2Connect() {
        if (!this.pm2) {
            await pm2Connect();
            this.pm2 = pm2;
        }
        return this.pm2;
    }
    async pm2Disconnect() {
        if (this.pm2) {
            await pm2Disconnect();
            this.pm2 = null;
        }
    }
}
exports.ProcessManager = ProcessManager;
//# sourceMappingURL=bbox.js.map