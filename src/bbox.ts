import * as globby from 'globby';
import * as shell from 'shelljs';
import * as process from 'process';
import { difference } from 'lodash';
import { dirname } from 'path';
import * as fs from 'fs';
import * as pm2 from 'pm2';
import {promisify} from 'util';
import {StartOptions} from 'pm2';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import * as dockerCompose from 'docker-compose';
import {parse} from 'yamljs';
const { spawnSync } = require('child_process');

export interface RunnableFnOpts {
  module: Module;
}

type RunnableFn = (RunnableFnOpts) => Promise<any>;
type Runnable = string | string[] | RunnableFn | RunnableFn[];

export interface App extends StartOptions {
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
  apps: App[];
  build?: Runnable;
  migrations?: {[key: string]: Runnable};
}

export interface Module extends ModuleFile {
  absolutePath: string;
  availableRuntimes: Runtime[],
  runtime: Runtime;
  state: ModuleState;
}

export interface Ctx {
}

export class ServiceCommandParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
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


export class Bbox {
  constructor(
    private opts: {cwd: string},
    private fileManager: FileManager,
    private runner: Runner,
    private processManager: ProcessManager
  ) {
  }

  @commandMethod()
  async build(params: ServiceCommandParams) {
    const module = await this.getModule(params.services[0]);

    await this.runBuild(module, {});
  }

  @commandMethod()
  async start(params: ServiceCommandParams) {
    const module = await this.getModuleForService(params.services[0]);

    const ctx = {};
    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);

    await this.runStart(module, params.services[0], ctx);
  }

  @commandMethod()
  async stop(params: ServiceCommandParams) {
    const {service, module} = await this.getService(params.services[0]);
    await this.processManager.stop(service);
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
      for (const app of module.apps) {
        console.log(`${app.name} [${module.name}] built: ${module.state.built}, pending migrations: ${this.getNotAppliedMigrations(module).join(', ')}, runtimes: ${module.availableRuntimes}`); // XXX
      }
    }
  }

  async shutdown() {
    await this.processManager.onShutdown();
  }

  async runStart(module: Module, appName: string, ctx: Ctx) {
    const app = module.apps.find(app => app.name === appName);

    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);

    if (!app) {
      throw new Error(`App ${appName} not found`);
    }
    await this.processManager.start(app);
  }

  async runRestartApp(module: Module, appName: string, ctx: Ctx) {
    const app = module.apps.find(app => app.name === appName);
    if (!app) {
      throw new Error(`App ${appName} not found`);
    }
    await this.processManager.restart(app);
  }

  async runBuild(module: Module, ctx: Ctx) {
    if (!module.build) {
      throw new Error('Module has not build action specified');
    }

    if (module.runtime === Runtime.DockerCompose) {
      await this.runDockerCompose(module, `bbox build ${module.name}`, ctx);
    } else {
      await this.runner.run(module, module.build, ctx);
    }

    module.state.built = true;
    this.fileManager.saveState(module);
  }

  async runMigrate(module: Module, ctx: Ctx): Promise<{state?: Partial<ModuleState>}> {
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

  private async runDockerCompose(module: Module, cmd: string, ctx: Ctx) {
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
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      console.error(ret); //XXX
      throw new Error('spawn error');
    }
  }

  private async runBuildIfNeeded(module: Module, ctx: Ctx) {
    if (module.state.built) {
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
    const modules = await this.fileManager.discoverModules(this.opts.cwd);
    const module = modules.find((module) => module.name === name);
    if (!module) {
      throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  private async getModuleForService(serviceName: string) {
    const modules = await this.fileManager.discoverModules(this.opts.cwd);
    const module = modules.find((module) => module.apps.find(app => app.name === serviceName) ?? false);
    if (!module) {
      throw new Error(`Service "${serviceName}" not found. Discovered services: TODO`);
    }
    return module;
  }

  private async getService(serviceName: string) {
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

  private getAllModules() {
    return this.fileManager.discoverModules(this.opts.cwd);
  }

  private getRunner(module: Module, command: Command, ctx: Ctx) {

  }
}

export class FileManager {
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
        const moduleStateFile: Partial<ModuleState> = require(`${absolutePath}/bbox.state.json`);
        // TODO types
        const state: ModuleState = Object.assign<ModuleState, Partial<ModuleState>>({
          ranMigrations: [],
          built: false
        }, moduleStateFile);
        const module: Module = Object.assign({
          absolutePath,
          state,
          availableRuntimes: [Runtime.Local],
          // TODO
          runtime: Runtime.DockerCompose
        }, moduleFile)

        // Apps
        for (const app of module.apps) {
          if (!app.name) {
            throw new Error(`No app name in ${moduleFilePath}`);
          }
          app.cwd = absolutePath;
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
        foundAppModule.availableRuntimes.push(Runtime.DockerCompose);
      }
    } catch (e) {
      if (e.err && e.err.includes('Can\'t find a suitable configuration file')) {
        console.log('No docker-compose configuration found'); // XXX
      } else {
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

export class ProcessManager {
  private pm2;

  async start(app: App) {
    await this.pm2Connect();
    await pm2Start(app);
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async restart(app: App) {
    await this.pm2Connect();
    await pm2Restart(app);
  }

  async stop(app: App) {
    await this.pm2Connect();
    try {
      await pm2Stop(app.name);
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
