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
exports.ProcessManager = exports.Runner = exports.FileManager = exports.Bbox = exports.commandMethod = exports.ListCommandParams = exports.ServiceCommandParams = exports.Runtime = exports.Command = void 0;
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
const { spawnSync } = require('child_process');
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
class Bbox {
    constructor(opts, fileManager, runner, processManager) {
        this.opts = opts;
        this.fileManager = fileManager;
        this.runner = runner;
        this.processManager = processManager;
    }
    async build(params) {
        const module = await this.getModule(params.services[0]);
        await this.runBuild(module, {});
    }
    async start(params) {
        const module = await this.getModuleForService(params.services[0]);
        const ctx = {};
        await this.runBuildIfNeeded(module, ctx);
        await this.runMigrationsIfNeeded(module, ctx);
        await this.runStart(module, params.services[0], ctx);
    }
    async stop(params) {
        const { service, module } = await this.getService(params.services[0]);
        await this.processManager.stop(service);
    }
    async migrate(params) {
        const module = await this.getModule(params.services[0]);
        await this.runMigrate(module, {});
    }
    async list(params) {
        const modules = await this.getAllModules();
        for (const module of modules) {
            for (const app of module.apps) {
                console.log(`${app.name} [${module.name}] built: ${module.state.built}, pending migrations: ${this.getNotAppliedMigrations(module).join(', ')}, runtimes: ${module.availableRuntimes}`); // XXX
            }
        }
    }
    async shutdown() {
        await this.processManager.onShutdown();
    }
    async runStart(module, appName, ctx) {
        const app = module.apps.find(app => app.name === appName);
        await this.runBuildIfNeeded(module, ctx);
        await this.runMigrationsIfNeeded(module, ctx);
        if (!app) {
            throw new Error(`App ${appName} not found`);
        }
        await this.processManager.start(app);
    }
    async runRestartApp(module, appName, ctx) {
        const app = module.apps.find(app => app.name === appName);
        if (!app) {
            throw new Error(`App ${appName} not found`);
        }
        await this.processManager.restart(app);
    }
    async runBuild(module, ctx) {
        if (!module.build) {
            throw new Error('Module has not build action specified');
        }
        if (module.runtime === Runtime.DockerCompose) {
            await this.runDockerCompose(module, `bbox build ${module.name}`, ctx);
        }
        else {
            await this.runner.run(module, module.build, ctx);
        }
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
    async runDockerCompose(module, cmd, ctx) {
        this.spawn('docker-compose', ['run', '--rm', module.name, cmd], {});
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
        const ret = spawnSync(cmd, args, {
            env,
            shell: true,
            stdio: 'inherit'
        });
        if (ret.status !== 0) {
            console.error(ret); //XXX
            throw new Error('spawn error');
        }
    }
    async runBuildIfNeeded(module, ctx) {
        if (module.state.built) {
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
        const modules = await this.fileManager.discoverModules(this.opts.cwd);
        const module = modules.find((module) => module.name === name);
        if (!module) {
            throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
        }
        return module;
    }
    async getModuleForService(serviceName) {
        const modules = await this.fileManager.discoverModules(this.opts.cwd);
        const module = modules.find((module) => { var _a; return (_a = module.apps.find(app => app.name === serviceName)) !== null && _a !== void 0 ? _a : false; });
        if (!module) {
            throw new Error(`Service "${serviceName}" not found. Discovered services: TODO`);
        }
        return module;
    }
    async getService(serviceName) {
        const modules = await this.fileManager.discoverModules(this.opts.cwd);
        for (const module of modules) {
            const service = module.apps.find(app => app.name === serviceName);
            if (service) {
                return {
                    module,
                    service
                };
            }
        }
        throw new Error(`Service "${serviceName}" not found.`);
    }
    getAllModules() {
        return this.fileManager.discoverModules(this.opts.cwd);
    }
    getRunner(module, command, ctx) {
    }
}
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
                const moduleStateFile = require(`${absolutePath}/bbox.state.json`);
                // TODO types
                const state = Object.assign({
                    ranMigrations: [],
                    built: false
                }, moduleStateFile);
                const module = Object.assign({
                    absolutePath,
                    state,
                    availableRuntimes: [Runtime.Local],
                    // TODO
                    runtime: Runtime.DockerCompose
                }, moduleFile);
                // Apps
                for (const app of module.apps) {
                    if (!app.name) {
                        throw new Error(`No app name in ${moduleFilePath}`);
                    }
                    app.cwd = absolutePath;
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
        console.log(modules); // XXX
        //const pluginServices = await this.runPlugins('discoverServices');
        //TODO do some magic to merge/select values from discovered plugin services
        //defaultsDeep(services, pluginServices);
        //console.log(modules); // XXX
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
        if (typeof runnable === 'function') {
            await runnable({
                module,
                ctx
            });
            return;
        }
        if (typeof runnable === 'string') {
            this.runShellCmd(module.absolutePath, runnable);
            return;
        }
        throw new Error('Can not run ' + typeof runnable);
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
class ProcessManager {
    async start(app) {
        await this.pm2Connect();
        await pm2Start(app);
    }
    async onShutdown() {
        return this.pm2Disconnect();
    }
    async restart(app) {
        await this.pm2Connect();
        await pm2Restart(app);
    }
    async stop(app) {
        await this.pm2Connect();
        try {
            await pm2Stop(app.name);
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
