import 'source-map-support/register';
import 'reflect-metadata';

import * as globby from 'globby';
import * as shell from 'shelljs';
import * as process from 'process';
import { difference } from 'lodash';
import { dirname } from 'path';
import * as fs from 'fs';
import * as pm2 from 'pm2';
import {promisify} from 'util';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import * as dockerCompose from 'docker-compose';
import {parse} from 'yamljs';
import {spawnSync} from 'child_process'
import {ls} from 'shelljs';
//import {ProxyConfig} from './proxy-server';
import * as YAML from 'yamljs'
import {ProxyConfig} from './proxy-server';

export interface RunnableFnOpts {
  module: Module;
}

//type RunnableFn = (RunnableFnOpts) => Promise<any>;
//type Runnable = string | string[] | RunnableFn | RunnableFn[];
type Runnable = string | string[];


export interface Service {
  name: string;
  port?: number;
  containerPort?: number;
  start?: string;
  env?: {[key: string]: any}
}

export enum Command {
  Build = 'Build'
}

export enum Runtime {
  Local = 'Local',
  DockerCompose = 'DockerCompose'
}

export interface ModuleState {
  ranMigrations: string[];
  built: boolean;
}

export interface ModuleFile {
  name: string;
  services: Service[];
  build?: Runnable;
  migrations?: {[key: string]: Runnable};
}

export interface Module extends ModuleFile {
  absolutePath: string;
  availableRuntimes: Runtime[],
  runtime: Runtime;
  state: ModuleState;
  services: Service[];
}

export interface Ctx {
}

export class ServiceCommandParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class RunCommandParams {
  @jf.string().required()
  runnable: string;
}

export class ProxyBuildParams {
  @jf.string().allow('')
  todo?: string;
}

export class ListCommandParams {
  @jf.string().allow('')
  mode?: string;
}

export function commandMethod(params: {paramsType?: any} = {}) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
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
          const error: any = val.error;
          //val.error.name = 'TypeError';
          const parsed = PrettyJoi.parseError(error);
          error.message = parsed.message;
          throw error;
        }
        arguments[0] = val.value;
      }

      return origMethod.apply(this, arguments);
    }
  }
}

export class BboxOpts {
  rootPath: string;
}

export class ProjectOpts {
  reverseProxy: {
    port: number
  };
  domain: string;
  proxyConfigPath: string;
  dockerComposeOverridePath: string;
}

export class Bbox {
  private projectOpts: ProjectOpts;

  constructor(
    private opts: BboxOpts,
    private fileManager: FileManager,
    private runner: Runner,
    private processManager: ProcessManager
  ) {
    this.projectOpts = {
      reverseProxy: {
        port: 8080
      },
      domain: 'local.app.garden',
      proxyConfigPath: `${this.opts.rootPath}/.bbox/proxy-config.json`,
      dockerComposeOverridePath: `${this.opts.rootPath}/.bbox/docker-compose.override.yml`
    }
  }

  async init() {
    const rootBboxPath = `${this.opts.rootPath}/.bbox`;
    if (!fs.existsSync(rootBboxPath)) {
      fs.mkdirSync(rootBboxPath);
    }
  }

  @commandMethod()
  async test(params: ServiceCommandParams) {
    //const {module, service} = await this.getService(params.services[0]);
    //console.log(module, service); // XXX
    //await this.processManager.sendDataToService(module, service);
  }

  @commandMethod()
  async proxyBuild(params: ProxyBuildParams) {
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
    const config: ProxyConfig = {
      port: this.projectOpts.reverseProxy.port,
      forward
    }
    fs.writeFileSync(this.projectOpts.proxyConfigPath, JSON.stringify(config, null, 2));

    // docker compose
    const dockerComposePath = `${this.opts.rootPath}/docker-compose.yml`;
    if (!fs.existsSync(dockerComposePath)) {
      throw new Error(`No ${dockerComposePath} exists`);
    }

    if (fs.existsSync(this.projectOpts.dockerComposeOverridePath)) {
      fs.unlinkSync(this.projectOpts.dockerComposeOverridePath);
    }

    const overwrite = {version: '3', services: {}};
    const services: {name: string, domainName: string, ip: string}[] = [];
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
        services.push({name: service.name, domainName: `${service.name}.${this.projectOpts.domain}`, ip: '172.17.0.1'});
      }
    }

    const extra_hosts = services.map((service) => {
      return `${service.domainName}:${service.ip}`;
    });
    for (const moduleName of moduleNames) {
      overwrite.services[moduleName] = {extra_hosts};
    }

    const yaml = YAML.stringify(overwrite);
    fs.writeFileSync(this.projectOpts.dockerComposeOverridePath, yaml);
  }

  @commandMethod()
  async proxyStart(params: ProxyBuildParams) {

  }

  @commandMethod()
  async run(params: RunCommandParams) {
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
    } catch (e) {
      console.error(e); // XXX
      throw e;
    }
  }

  @commandMethod()
  async build(params: ServiceCommandParams) {
    const module = await this.getModule(params.services[0]);

    await this.runBuild(module, {});
  }

  @commandMethod()
  async start(params: ServiceCommandParams) {
    const {module, service} = await this.getService(params.services[0]);

    const ctx = {};
    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);

    await this.runStart(module, params.services[0], ctx);

    await this.setProxyForwardForServiceIfNeeded(module, service);
  }

  @commandMethod()
  async stop(params: ServiceCommandParams) {
    const {service, module} = await this.getService(params.services[0]);
    await this.processManager.stop(module, service);

    await this.unsetProxyForwardForServiceIfNeeded(module, service);
  }

  @commandMethod()
  async migrate(params: ServiceCommandParams) {
    const module = await this.getModule(params.services[0]);
    await this.runMigrate(module, {});
  }

  @commandMethod()
  async list(params: ListCommandParams) {
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

  private async runStart(module: Module, appName: string, ctx: Ctx) {
    const app = module.services.find(app => app.name === appName);

    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);

    if (!app) {
      throw new Error(`App ${appName} not found`);
    }
    await this.processManager.start(module, app);
  }

  private async runRestartApp(module: Module, appName: string, ctx: Ctx) {
    const app = module.services.find(app => app.name === appName);
    if (!app) {
      throw new Error(`App ${appName} not found`);
    }
    await this.processManager.restart(module, app);
  }

  private async runBuild(module: Module, ctx: Ctx) {
    if (!module.build) {
      throw new Error('Module has not build action specified');
    }

    await this.runner.run(module, module.build, ctx);

    module.state.built = true;
    this.fileManager.saveState(module);
  }

  private async runMigrate(module: Module, ctx: Ctx): Promise<{state?: Partial<ModuleState>}> {
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
      } catch (e) {
        console.log(`> Migration ${migId} failed.`); // XXX
        throw e;
      }
    }

    console.log(`> All new migrations applied.`); // XXX

    return {};
  }

  private async runBuildIfNeeded(module: Module, ctx: Ctx) {
    if (module.state.built || !module.build) {
      return;
    }

    await this.runBuild(module, ctx);
  }

  private async runMigrationsIfNeeded(module: Module, ctx: Ctx) {
    const migrations = this.getNotAppliedMigrations(module);
    if (migrations.length === 0) {
      return;
    }

    await this.runMigrate(module, ctx);
  }

  private getNotAppliedMigrations(module: Module) {
    if (!module.migrations) {
      return [];
    }

    const migrationIds = Object.keys(module.migrations).sort();
    const diff = difference(migrationIds, module.state.ranMigrations);
    return diff;
  }

  private async getModule(name: string) {
    const modules = await this.getAllModules();
    const module = modules.find((module) => module.name === name);
    if (!module) {
      throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  private async getModuleForService(serviceName: string) {
    const modules = await this.getAllModules();
    const module = modules.find((module) => module.services.find(app => app.name === serviceName) ?? false);
    if (!module) {
      throw new Error(`Service "${serviceName}" not found. Discovered services: TODO`);
    }
    return module;
  }

  private async getService(serviceName: string) {
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

  private async getAllModules() {
    const modules = await this.fileManager.discoverModules(this.opts.rootPath);
    // Proxy module
    modules.push({
      name: 'proxy',
      absolutePath: __dirname,
      availableRuntimes: [Runtime.Local],
      runtime: Runtime.Local,
      state: {built: true, ranMigrations: []},
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

  private setProxyForwardForServiceIfNeeded(module: Module, service: Service) {

  }

  private unsetProxyForwardForServiceIfNeeded(module: Module, service: Service) {
    console.log(module, service); // XXX
  }
}

export class FileManager {
  discoverRootPath(path: string): string {
    let rootPath = undefined;
    let currentPath = path;
    do {
      if (fs.existsSync(`${currentPath}/bbox.project.js`)) {
        rootPath = currentPath;
      }
      const newPath = dirname(currentPath);
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

  async discoverModules(path: string): Promise<Module[]> {
    const paths = globby.sync([
      '*/bbox.config.js'
    ], {
      cwd: path,
      absolute: true,
      gitignore: true
    });

    const modules: Module[] = [];
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = dirname(moduleFilePath);
        const moduleFile: ModuleFile = require(moduleFilePath);
        const stateFilePath = `${absolutePath}/bbox.state.json`;
        if (!fs.existsSync(stateFilePath)) {
          fs.writeFileSync(stateFilePath, '{}');
        }
        const moduleStateFile: Partial<ModuleState> = require(stateFilePath);
        // TODO types
        const state: ModuleState = Object.assign<ModuleState, Partial<ModuleState>>({
          ranMigrations: [],
          built: false
        }, moduleStateFile);
        // moduleFile.services = moduleFile.services.map<Service>((serviceFile) => {
        //   return Object.assign({
        //     env: {}
        //   }, serviceFile)
        // });
        const module: Module = Object.assign({
          absolutePath,
          state,
          availableRuntimes: [],
          runtime: undefined
        }, moduleFile)

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
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    // @DockerCompose
    try {
      const dockerComposeServices = await dockerCompose.config({cwd: path});
      const dockerComposeFile = parse(dockerComposeServices.out);
      const services = Object.keys(dockerComposeFile.services);
      for (const serviceName of services) {
        const foundAppModule = modules.find((module) => module.name === serviceName);
        if (!foundAppModule) {
          throw new Error(`Module not found: ${serviceName}`)
        }
        foundAppModule.availableRuntimes.push(Runtime.DockerCompose);
      }
    } catch (e) {
      if (e.err && e.err.includes('Can\'t find a suitable configuration file')) {
        console.log('No docker-compose configuration found'); // XXX
      } else {
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

  saveState(module: Module) {
    fs.writeFileSync(`${module.absolutePath}/bbox.state.json`, JSON.stringify(module.state, null, 2));
  }
}

export class Runner {
  async run(module: Module, runnable: Runnable, ctx: Ctx) {
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

  private async runDockerCompose(module: Module, cmd: string, ctx: Ctx) {
    const args = [];

    // linux
    // const hostIp = '172.17.0.1';
    // args.push(`--add-host=xxx:${hostIp}`);

    this.spawn('docker-compose', ['run', '--rm', '--use-aliases', ...args, module.name, cmd], {});
  }

  private runShellCmd(cwd: string, cmd: string) {
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

  private spawn(cmd, args, opts) {
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
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      console.error(ret); //XXX
      throw new Error('spawn error');
    }
  }

  private createExecOpts() {
    const env = process.env;
    const opts = {
      //async: true //TODO
      silent: false,
      windowsHide: true, //do not open terminal window on Windows
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

const pm2Connect = promisify(pm2.connect).bind(pm2);
const pm2Disconnect = promisify(pm2.disconnect).bind(pm2);
const pm2Start = promisify(pm2.start).bind(pm2);
const pm2Restart = promisify(pm2.restart).bind(pm2);
const pm2Stop = promisify(pm2.stop).bind(pm2);
const pm2List = promisify(pm2.list).bind(pm2);
const pm2SendDataToProcessId = promisify(pm2.sendDataToProcessId).bind(pm2);

export class ProcessManager {
  private pm2;

  async start(module: Module, service: Service) {
    await this.pm2Connect();
    if (module.runtime === Runtime.DockerCompose) {
      const args = [];

      // linux
      //const hostIp = '172.17.0.1';
      //args.push(`--add-host=xxx:${hostIp}`);

      if (service.port) {
        args.push(`-p ${service.port}:${service.containerPort ?? service.port}`);
      }

      const runCmd = `run --rm ${args.join(' ')} ${module.name}`;
      console.log(runCmd); // XXX
      if (service.start) {
        await pm2Start({
          name: service.name,
          script: 'docker-compose',
          args: `${runCmd} ${service.start}`
        });
      } else {
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

  async sendDataToService(module: Module, service: Service) {
    await this.pm2Connect();
    const processList = await pm2List();

    const ret = await pm2SendDataToProcessId(0, {
      id: 0,
      type : 'message',
      data : {
        some : 'data',
        hello : true
      },
      topic: 'some topic'
    });
    console.log(ret); // XXX
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async restart(module: Module, service: Service) {
    await this.pm2Connect();
    await pm2Restart(service.start);
  }

  async stop(module: Module, service: Service) {
    await this.pm2Connect();
    try {
      await pm2Stop(service.name);
    } catch (e) {
      throw new Error(`PM2 error: ${e.message}`);
    }
  }

  private async pm2Connect() {
    if (!this.pm2) {
      await pm2Connect();
      this.pm2 = pm2;
    }

    return this.pm2;
  }

  private async pm2Disconnect() {
    if (this.pm2) {
      await pm2Disconnect();
      this.pm2 = null;
    }
  }
}
