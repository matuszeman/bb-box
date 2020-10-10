import 'source-map-support/register';
import 'reflect-metadata';

import * as Commander from 'commander';
import { difference, find } from 'lodash';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import {WaitOnOptions} from 'wait-on';
import {ProcessList, ProcessManager} from './process-manager';
import {BboxDiscovery} from './bbox-discovery';
import { Ui } from './ui';
import * as shelljs from 'shelljs';

export type Cli = Commander.Command;

export interface RunnableFnParams {
  bbox: Bbox;
  ctx: Ctx;
  module: Module;
}

export type RunnableFn = (params: RunnableFnParams) => Promise<any>;
export type Runnable = string | RunnableFn;
export type RunnableSpec = Runnable | Runnable[];
export type DependencySpec = string;
export type EnvValuesSpec = {[key: string]: any};

export enum ServiceProcessStatus {
  Unknown = 'Unknown',
  Online = 'Online',
  Offline = 'Offline'
}

export interface SubServiceSpec {
  name: string;
  port?: number;
  containerPort?: number;
}

export class ServiceDocker {
  volumes: DockerVolumes;
}

export interface ServiceSpec {
  name: string;
  port?: number;
  // move to docker prop?
  containerPort?: number;
  start?: string;
  subServices?: {
    [key: string]: SubServiceSpec
  }
  docker?: {
    volumes?: DockerVolumesSpec
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

export enum Runtime {
  Local = 'Local',
  Docker = 'Docker'
}

export interface ModuleState {
  built: boolean;
  builtOnce: string[];
  configured: boolean;
  configuredOnce: string[];
  initialized: boolean;
  initializedOnce: string[];
}

export type ProcessSpec = Runnable;

export type RunOnceSpec = {[key: string]: ProcessSpec};

export class BuildSpec {
  once: RunOnceSpec;
  run: ProcessSpec;
}

export class ConfigureSpec {
  once?: RunOnceSpec;
  run?: ProcessSpec;
}

export class InitializeSpec {
  once: RunOnceSpec;
  run: ProcessSpec;
}

export class DockerVolumesSpec {
  [key: string]: string | {containerPath: string, hostPath: string}
}

export class ModuleSpec {
  name: string;
  docker?: {
    image?: string;
    file?: string;
    volumes?: DockerVolumesSpec
  };
  services: {[key: string]: ServiceSpec};
  runtime?: Runtime;
  configure?: ConfigureSpec;
  initialize?: InitializeSpec;
  build?: BuildSpec;
  //migrations?: {[key: string]: RunnableSpec};
  env?: {[key: string]: any};
}

export interface BboxModule {
  onInit?(bbox: Bbox, ctx: Ctx): Promise<any>;
  onCliInit?(bbox: Bbox, cli: Cli, ctx: Ctx): Promise<any>;
  beforeStart?(bbox: Bbox, ctx: Ctx): Promise<any>;
  beforeStatus?(bbox: Bbox, ctx: Ctx): Promise<any>;
}

export interface ServiceState {
  processStatus: ServiceProcessStatus
}

export class Service {
  module: Module;
  name: string;
  spec: ServiceSpec;
  state: ServiceState;
  docker?: ServiceDocker;
}

export type DockerVolumes = {
  [name: string]: {
    containerPath: string;
    hostPath: string;
  }
}

export class ModuleDocker {
  volumes: DockerVolumes;
}

export class Module {
  root: boolean;
  name: string;
  spec: ModuleSpec;
  docker?: ModuleDocker;
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
  projectOpts: ProjectOpts
  processList: ProcessList,
  stagedStates: {service?: {service: Service, state: Partial<ServiceState>}, module?: {module: Module, state: Partial<ModuleState>}}[];
}

export class ServiceCommandParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class RunCommandParams {
  @jf.string().required()
  module: string;
  @jf.string().required()
  cmd: string;
}

export class ConfigureParams {
  @jf.string().required()
  module?: string;
}

export class InitializeParams {
  @jf.string().required()
  module?: string;
}

export class ShellParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class ListCommandParams {
  @jf.string().allow('')
  mode?: string;
}

export function validateParams(params: {paramsType?: any} = {}) {
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
    private processManager: ProcessManager,
    private ui: Ui
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

  @validateParams()
  async test(params: ServiceCommandParams, ctx: Ctx) {
    //const {module, service} = await this.getService(params.services[0]);
    //console.log(module, service); // XXX
    //await this.processManager.sendDataToService(module, service);
  }

  @validateParams()
  async configure(params: ConfigureParams, ctx: Ctx) {
    const module = this.getModule(params.module);
    this.stageConfigure(module, ctx);
    await this.executeStaged(ctx);
  }

  @validateParams()
  async initialize(params: InitializeParams, ctx: Ctx) {
    const module = this.getModule(params.module);
    this.stageInitialize(module, ctx);
    await this.executeStaged(ctx);
  }

  async run(params: RunCommandParams, ctx: Ctx) {
    const module = this.getModule(params.module);
    try {
      await this.runInteractive(module, params.cmd, ctx);
    } catch (e) {
      console.error(e); // XXX
      throw e;
    }
  }

  @validateParams()
  async shell(params: ShellParams, ctx: Ctx) {
    const module = this.getModule(params.services[0]);

    //TODO
  }

  @validateParams()
  async build(params: ServiceCommandParams, ctx: Ctx) {
    const module = this.getModule(params.services[0]);

    await this.stageBuild(module, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const service = this.getService(params.services[0]);

    await this.stageStartDependenciesIfNeeded(service, ctx);

    await this.stageStart(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const service = await this.getService(params.services[0]);

    this.stageServiceState(service, {processStatus: ServiceProcessStatus.Offline}, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async value(params: ServiceCommandParams, ctx: Ctx) {
    const ret = await this.provideValue(params.services[0], ctx);
    console.log(ret); // XXX
  }

  private async executeStaged(ctx: Ctx) {
    for (const moduleOrService of ctx.stagedStates) {
      // TODO detect module or service
      if (moduleOrService.module) {
        const {module, state} = moduleOrService.module;
        console.log(`Module ${module.name}: Applying state`, state); // XXX
        if (typeof state.built !== 'undefined') {
          if (state.built && !module.state.built) {
            await this.runBuild(module, ctx);
          }
        }

        if (typeof state.configured !== 'undefined') {
          if (state.configured && !module.state.configured) {
            await this.runConfigure(module, ctx);
          }
        }

        if (typeof state.initialized !== 'undefined') {
          if (state.initialized && !module.state.initialized) {
            await this.runInitialize(module, ctx);
          }
        }
      }

      if (moduleOrService.service) {
        const {service, state} = moduleOrService.service;
        console.log(`Service ${service.name}: Applying state`, state); // XXX
        if (typeof state.processStatus !== 'undefined') {
          switch (state.processStatus) {
            case ServiceProcessStatus.Online:
              await this.processManager.startAndWaitUntilStarted(service, ctx);
              break;
            case ServiceProcessStatus.Offline:
              await this.processManager.stopAndWaitUntilStopped(service, ctx);
              break;
            default:
              throw new Error(`Unhandled ServiceProcessStatus ${state.processStatus}`);
          }
        }
      }

    }
  }

  async provideValue(valueName, ctx) {
    try {
      const [serviceName, providerName] = valueName.split('.');
      const service = await this.getService(serviceName);
      const serviceSpec = service.spec;

      if (serviceSpec.values && serviceSpec.values[providerName]) {
        return serviceSpec.values[providerName];
      }

      if (!serviceSpec.valueProviders || !serviceSpec.valueProviders[providerName]) {
        throw new Error(`Value provider ${providerName} not found`);
      }

      this.stageBuildIfNeeded(service.module, ctx);
      await this.executeStaged(ctx);

      return await this.processManager.run(service.module, serviceSpec.valueProviders[providerName], serviceSpec.env, ctx);
    } catch (e) {
      throw Error(`Could not get ${valueName} value: ${e.message}`);
    }
  }

  @validateParams()
  async list(params: ListCommandParams, ctx: Ctx) {
    const modules = this.getAllModules();
    for (const module of modules) {
      for (const service of Object.values(module.services)) {
        const process = await this.processManager.findServiceProcess(service, ctx);
        console.log(`${service.name} [${module.name}]: ${process?.status ?? 'Unknown'}, configured: ${module.state.configured}, built: ${module.state.built}, runtimes: ${module.availableRuntimes}`); // XXX
      }
    }
  }

  async shutdown() {
    await this.processManager.onShutdown();
  }

  private async stageStart(service: Service, ctx: Ctx) {
    // if (service.spec.provideEnvValues) {
    //   const envValues = await this.provideValues(service.spec.provideEnvValues, ctx);
    //   Object.assign(service.spec.env, envValues);
    // }
    this.stageInitializeIfNeeded(service.module, ctx);

    const values = this.getValuePlaceholders(service.spec.start);
    for (const value of values) {
      this.stageValueAvailability(value, ctx);
    }

    this.stageServiceState(service, {processStatus: ServiceProcessStatus.Online}, ctx);
  }

  private stageValueAvailability(value: string, ctx: Ctx) {
    const [serviceName, providerName] = value.split('.');
    const service = this.getService(serviceName);
    const serviceSpec = service.spec;

    if (serviceSpec.values && serviceSpec.values[providerName]) {
      return;
    }

    if (!serviceSpec.valueProviders || !serviceSpec.valueProviders[providerName]) {
      throw new Error(`Value provider ${providerName} not found`);
    }

    // TODO
    this.stageServiceState(service, {processStatus: ServiceProcessStatus.Online}, ctx);
  }

  private getValuePlaceholders(str) {
    const regex = /\[(.*?)\]/gm;
    let m;

    const ret = [];
    while ((m = regex.exec(str)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      ret.push(m[1]);
    }

    return ret;
  }

  async stageStartDependenciesIfNeeded(service: Service, ctx: Ctx) {
    const serviceSpec = service.spec;
    if (!serviceSpec.dependencies) {
      return;
    }

    for (const serviceDependencyName of serviceSpec.dependencies) {
      const service = this.getService(serviceDependencyName);
      await this.stageStartDependenciesIfNeeded(service, ctx);
      await this.stageStart(service, ctx);
    }
  }

  async provideValues(values: {[key: string]: string}, ctx) {
    const ret = {};
    for (const envName in values) {
      ret[envName] = await this.provideValue(values[envName], ctx);
    }
    return ret;
  }

  private stageConfigure(module: Module, ctx: Ctx) {
    module.state.configured = false;
    this.stageModuleState(module, {configured: true}, ctx);
  }

  private stageConfigureIfNeeded(module: Module, ctx: Ctx) {
    if (!module.spec.configure) {
      return;
    }

    let notAppliedMigrations = [];
    if (module.spec.configure.once) {
      notAppliedMigrations = this.getNotAppliedMigrations(module.spec.configure.once, module.state.configuredOnce);
    }

    if (module.state.configured && notAppliedMigrations.length === 0) {
      return;
    }

    this.stageConfigure(module, ctx);
  }

  private async runConfigure(module: Module, ctx: Ctx) {
    if (!module.spec.configure) {
      throw new Error('Module has not `configure` specified');
    }

    if (module.spec.configure.run) {
      await this.runInteractive(module, module.spec.configure.run, ctx);
    }

    if (module.spec.configure.once) {
      await this.runOnce(module, module.spec.configure.once, module.state.configuredOnce, ctx);
    }

    module.state.configured = true;
    this.fileManager.saveModuleState(module);
  }

  private stageInitialize(module: Module, ctx: Ctx) {
    this.stageConfigureIfNeeded(module, ctx);

    module.state.initialized = false;
    this.stageModuleState(module, {initialized: true}, ctx);
  }

  private stageInitializeIfNeeded(module: Module, ctx: Ctx) {
    this.stageBuildIfNeeded(module, ctx);

    if (module.state.initialized || !module.spec.initialize) {
      return;
    }

    this.stageModuleState(module, {initialized: true}, ctx);
  }

  private async runInitialize(module: Module, ctx: Ctx) {
    if (!module.spec.initialize) {
      throw new Error('Module has not `configure` specified');
    }

    if (module.spec.initialize.run) {
      await this.runInteractive(module, module.spec.initialize.run, ctx);
    }

    if (module.spec.initialize.once) {
      await this.runOnce(module, module.spec.initialize.once, module.state.initializedOnce, ctx);
    }

    module.state.initialized = true;
    this.fileManager.saveModuleState(module);
  }

  private stageBuild(module: Module, ctx: Ctx) {
    module.state.built = false;
    this.stageModuleState(module, {built: true}, ctx);
  }

  private stageBuildIfNeeded(module: Module, ctx: Ctx) {
    this.stageConfigureIfNeeded(module, ctx);

    if (module.state.built || !module.spec.build) {
      return;
    }

    this.stageBuild(module, ctx);
  }

  private async runBuild(module: Module, ctx: Ctx) {
    const spec = module.spec.build;
    if (!spec) {
      throw new Error('Module has not `build` specified');
    }

    if (spec.once) {
      await this.runOnce(module, spec.once, module.state.builtOnce, ctx);
    }

    if (spec.run) {
      await this.runInteractive(module, spec.run, ctx);
    }

    module.state.built = true;
    this.fileManager.saveModuleState(module);
  }

  private stageServiceState(service: Service, state: Partial<ServiceState>, ctx: Ctx) {
    const states = ctx.stagedStates
      .filter((staged) => staged.service)
      .map((s) => s.service.state);
    const found = find(states, state);
    if (found) {
      return;
    }

    ctx.stagedStates.push({service: {service, state}});
  }

  private stageModuleState(module: Module, state: Partial<ModuleState>, ctx: Ctx) {
    const states = ctx.stagedStates
      .filter((staged) => staged.module)
      .map((s) => s.module.state);
    const found = find(states, state);
    if (found) {
      return;
    }

    ctx.stagedStates.push({module: {module, state}});
  }

  private async runOnce(module: Module, runOnceSpec: RunOnceSpec, state: string[], ctx: Ctx): Promise<{state?: Partial<ModuleState>}> {
    const diff = this.getNotAppliedMigrations(runOnceSpec, state);
    if (diff.length === 0) {
      console.log('> No new migrations'); // XXX
      return;
    }

    for (const migId of diff) {
      try {
        console.log(`> Migrating ${migId}`); // XXX
        await this.runInteractive(module, runOnceSpec[migId], ctx);

        state.push(migId);
        this.fileManager.saveModuleState(module);
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
      for (const run of runnable) {
        await this.runInteractive(module, run, ctx);
      }
      return;
    }

    try {
      if (typeof runnable === 'function') {
        shelljs.pushd(module.cwdAbsolutePath);
        try {
          await runnable({
            bbox: this,
            ctx: ctx,
            module: module
          });
        } finally {
          shelljs.popd();
        }
        return;
      }

      await this.processManager.runInteractive(module, runnable, {}, ctx);
    } catch (e) {
      console.error(e); // XXX
      this.ui.print(`**There was an error when running:** \`${runnable}\``);
      const ret = await this.ui.prompt<{continue: boolean}>([
        {type: 'confirm', name: 'continue', default: false, message: 'Continue?'}
      ]);
      if (!ret.continue) {
        throw e;
      }
    }
  }

  // private async stageMigrationsIfNeeded(module: Module, ctx: Ctx) {
  //   const migrations = this.getNotAppliedMigrations(module);
  //   if (migrations.length === 0) {
  //     return;
  //   }
  //
  //   this.stageModuleState(module, {ranAllMigrations: true}, ctx);
  // }

  private getNotAppliedMigrations(current: RunOnceSpec, ran: string[]) {
    const migrationIds = Object.keys(current).sort();
    const diff = difference(migrationIds, ran);
    return diff;
  }

  getModule(name: string) {
    const modules = this.getAllModules();
    const module = modules.find((module) => module.name === name);
    if (!module) {
      throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  getService(serviceName: string) {
    const modules = this.getAllModules();
    for (const module of modules) {
      const service = Object.values(module.services).find(service => service.name === serviceName);
      if (service) {
        return service;
      }
    }

    throw new Error(`Service "${serviceName}" not found.`);
  }

  getAllModules() {
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
}

