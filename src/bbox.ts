import 'source-map-support/register';
import 'reflect-metadata';

import * as Commander from 'commander';
import { difference } from 'lodash';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import {WaitOnOptions} from 'wait-on';
import {ProcessList, ProcessManager} from './process-manager';
import {BboxDiscovery} from './bbox-discovery';

export type Cli = Commander.Command;

export interface RunnableFnOpts {
  module: Module;
}

//type RunnableFn = (RunnableFnOpts) => Promise<any>;
//type Runnable = string | string[] | RunnableFn | RunnableFn[];
type RunnableSpec = string | string[];
type DependencySpec = string;
export type EnvValuesSpec = {[key: string]: any};

enum ServiceProcessStatus {
  Unknown = 'Unknown',
  Online = 'Online'
}

export interface SubServiceSpec {
  name: string;
  port?: number;
  containerPort?: number;
}

export interface ServiceSpec {
  name: string;
  port?: number;
  containerPort?: number;
  start?: string;
  subServices?: {
    [key: string]: SubServiceSpec
  }
  env: EnvValuesSpec,
  provideEnvValues?: {[key: string]: string},
  dependencies?: DependencySpec[],
  healthCheck?: {
    // https://www.npmjs.com/package/wait-on#nodejs-api-usage
    waitOn: WaitOnOptions
  },
  valueProviders?: {[key: string]: string}
  values?: {[key: string]: any}
}

export enum Command {
  Build = 'Build'
}

export enum Runtime {
  Local = 'Local',
  Docker = 'Docker'
}

export interface ModuleState {
  ranMigrations: string[];
  built: boolean;
}

export class ModuleSpec {
  name: string;
  docker?: {
    image?: string;
    file?: string;
    volumes?: {
      [key: string]: string
    }
  };
  services: {[key: string]: ServiceSpec};
  runtime?: Runtime;
  build?: RunnableSpec;
  migrations?: {[key: string]: RunnableSpec};
  env?: {[key: string]: any};
}

export interface BboxModule {
  onInit?(bbox: Bbox, ctx: Ctx): Promise<any>;
  onCliInit?(bbox: Bbox, cli: Cli, ctx: Ctx): Promise<any>;
  beforeStart?(bbox: Bbox, ctx: Ctx): Promise<any>;
  beforeStatus?(bbox: Bbox, ctx: Ctx): Promise<any>;
}

export class Service {
  name: string;
  spec: ServiceSpec;
}

export class Module {
  root: boolean;
  name: string;
  spec: ModuleSpec;
  bboxPath: string;
  bboxModule?: BboxModule;
  absolutePath: string;
  path: string;
  cwdAbsolutePath: string;
  availableRuntimes: Runtime[];
  runtime: Runtime;
  state: ModuleState;
  services: {[key: string]: Service};
}

export interface Ctx {
  projectOpts: ProjectOpts,
  processList: ProcessList
}

export class ServiceCommandParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class RunCommandParams {
  @jf.string().required()
  runnable: string;
}

export class ConfigureParams {
  @jf.string().allow('')
  todo?: string;
}

export class ShellParams {
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

export class ProjectOpts {
  rootPath: string;
  dockerComposePath: string;
}

export class Bbox {
  private modules: Module[];

  constructor(
    private fileManager: BboxDiscovery,
    private processManager: ProcessManager
  ) {
  }

  async init(ctx: Ctx) {
    this.modules = await this.loadAllModules(ctx);

    for (const module of this.modules) {
      if (module.bboxModule?.onInit) {
        await module.bboxModule.onInit(this, ctx);
      }
    }
  }

  async onCliInit(cli: Cli, ctx: Ctx) {
    for (const module of this.modules) {
      if (module.bboxModule?.onCliInit) {
        await module.bboxModule.onCliInit(this, cli, ctx);
      }
    }
  }

  @commandMethod()
  async test(params: ServiceCommandParams, ctx: Ctx) {
    //const {module, service} = await this.getService(params.services[0]);
    //console.log(module, service); // XXX
    //await this.processManager.sendDataToService(module, service);
  }

  @commandMethod()
  async configure(params: ConfigureParams, ctx: Ctx) {

  }

  @commandMethod()
  async run(params: RunCommandParams, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    if (modules.length === 0) {
      throw new Error('No modules found');
    }
    if (modules.length > 1) {
      throw new Error('More modules found');
    }
    const module = modules[0];

    try {
      await this.runInteractive(module, params.runnable, ctx);
    } catch (e) {
      console.error(e); // XXX
      throw e;
    }
  }

  @commandMethod()
  async shell(params: ShellParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);

    //TODO
  }

  @commandMethod()
  async build(params: ServiceCommandParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);

    await this.runBuild(module, ctx);
  }

  @commandMethod()
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const {module, service} = await this.getService(params.services[0], ctx);

    await this.runStartDependenciesIfNeeded(module, service, ctx);

    await this.runStart(module, service, ctx);
  }

  @commandMethod()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const {service, module} = await this.getService(params.services[0], ctx);
    await this.processManager.stop(module, service, ctx);
  }

  @commandMethod()
  async migrate(params: ServiceCommandParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);
    await this.runMigrate(module, ctx);
  }

  @commandMethod()
  async value(params: ServiceCommandParams, ctx: Ctx) {
    const ret = await this.provideValue(params.services[0], ctx);
    console.log(ret); // XXX
  }

  async provideValue(valueName, ctx) {
    try {
      const [serviceName, providerName] = valueName.split('.');
      const {module, service} = await this.getService(serviceName, ctx);
      const serviceSpec = service.spec;

      if (serviceSpec.values && serviceSpec.values[providerName]) {
        return serviceSpec.values[providerName];
      }

      if (!serviceSpec.valueProviders || !serviceSpec.valueProviders[providerName]) {
        throw new Error(`Value provider ${providerName} not found`);
      }

      await this.runBuildIfNeeded(module, ctx);
      return await this.processManager.run(module, serviceSpec.valueProviders[providerName], serviceSpec.env, ctx);
    } catch (e) {
      throw Error(`Could not get ${valueName} value: ${e.message}`);
    }
  }

  @commandMethod()
  async list(params: ListCommandParams, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    for (const module of modules) {
      for (const service of Object.values(module.services)) {
        const process = await this.processManager.findServiceProcess(service, ctx);
        console.log(`${service.name} [${module.name}]: ${process?.status ?? 'Unknown'}, built: ${module.state.built}, pending migrations: ${this.getNotAppliedMigrations(module).join(', ')}, runtimes: ${module.availableRuntimes}`); // XXX
      }
    }
  }

  async shutdown() {
    await this.processManager.onShutdown();
  }

  private async runStart(module: Module, service: Service, ctx: Ctx) {
    if (service.spec.provideEnvValues) {
      const envValues = await this.provideValues(service.spec.provideEnvValues, ctx);
      Object.assign(service.spec.env, envValues);
    }

    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);
    await this.processManager.startIfNeeded(module, service, ctx);
  }

  async runStartDependenciesIfNeeded(module: Module, service: Service, ctx: Ctx) {
    const serviceSpec = service.spec;
    if (!serviceSpec.dependencies) {
      return;
    }

    for (const serviceDependencyName of serviceSpec.dependencies) {
      const {module, service} = await this.getService(serviceDependencyName, ctx);
      await this.runStartDependenciesIfNeeded(module, service, ctx);
      await this.runStart(module, service, ctx);
    }
  }

  async getModule(name: string, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    const module = modules.find((module) => module.name === name);
    if (!module) {
      throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  async getService(serviceName: string, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    for (const module of modules) {
      const service = Object.values(module.services).find(service => service.name === serviceName);
      if (service) {
        return {
          module,
          service
        };
      }
    }

    throw new Error(`Service "${serviceName}" not found.`);
  }

  async getAllModules(ctx: Ctx) {
    if (!this.modules) {
      throw new Error('Modules not initialized');
    }
    return this.modules;
  }

  async loadAllModules(ctx: Ctx) {
    const internalModules = await this.fileManager.discoverInternalModules(ctx.projectOpts.rootPath);
    const modules = await this.fileManager.discoverModules(ctx.projectOpts.rootPath);
    modules.push(...internalModules);
    return modules;
  }

  async provideValues(values: {[key: string]: string}, ctx) {
    const ret = {};
    for (const envName in values) {
      ret[envName] = await this.provideValue(values[envName], ctx);
    }
    return ret;
  }

  private async runBuild(module: Module, ctx: Ctx) {
    if (!module.spec.build) {
      throw new Error('Module has not build action specified');
    }

    await this.runInteractive(module, module.spec.build, ctx);

    module.state.built = true;
    this.fileManager.saveState(module);
  }

  private async runMigrate(module: Module, ctx: Ctx): Promise<{state?: Partial<ModuleState>}> {
    if (!module.spec.migrations) {
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
        await this.runInteractive(module, module.spec.migrations[migId], ctx);

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

  private async runInteractive(module: Module, runnable: RunnableSpec, ctx: Ctx) {
    if (Array.isArray(runnable)) {
      for (const cmd of runnable) {
        await this.processManager.runInteractive(module, cmd, {}, ctx);
      }
      return;
    }

    await this.processManager.runInteractive(module, runnable, {}, ctx);
  }

  private async runBuildIfNeeded(module: Module, ctx: Ctx) {
    if (module.state.built || !module.spec.build) {
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
    if (!module.spec.migrations) {
      return [];
    }

    const migrationIds = Object.keys(module.spec.migrations).sort();
    const diff = difference(migrationIds, module.state.ranMigrations);
    return diff;
  }
}

