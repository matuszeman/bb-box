import 'source-map-support/register';
import 'reflect-metadata';
import {difference, find} from 'lodash';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import {WaitOnOptions} from 'wait-on';
import {ProcessList, ProcessManager, ProcessStatus} from './process-manager';
import {BboxDiscovery} from './bbox-discovery';
import {PromptParams, Ui} from './ui';
import * as shelljs from 'shelljs';
import {Cli} from './cli';

export interface RunnableFnParams {
  bbox: Bbox;
  ctx: Ctx;
  module: Module;
}

export type RunnableFn = (params: RunnableFnParams) => Promise<any>;
export type Runnable = string | RunnableFn;
export type RunnableSpec = Runnable | Runnable[];
export type DependencySpec = {service: string, state: string};
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
  /**
   * https://pm2.keymetrics.io/docs/usage/pm2-api/#programmatic-api
   */
  pm2Options?: {
    minUptime?: number
    // ...
  },
  subServices?: {
    [key: string]: SubServiceSpec
  }
  docker?: {
    volumes?: DockerVolumesSpec
  }
  env: EnvValuesSpec,
  provideEnvValues?: {[key: string]: string},
  dependencies?: DependenciesSpec,
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

export class RunState {
  lastRanAt?: string;
  prompt?: {[key: string]: any};
}

export class RunStateMap {
  [key: string]: RunState;
}

export interface ModuleState {
  built: boolean;
  buildState: RunStateMap;
  configured: boolean;
  configureState: RunStateMap;
  initialized: boolean;
  initializeState: RunStateMap;
}

export type ProcessSpec = Runnable;

export type RunOnceSpec = {[key: string]: ProcessSpec};

export type DependenciesSpec = DependencySpec[];

export class RunSpec {
  run: Runnable;
  once?: boolean;
  env?: EnvValuesSpec;
  dependencies?: DependenciesSpec;
  prompt?: PromptParams<any>;
}

export class RunMapSpec {
  [key: string]: RunSpec;
}

export class BuildSpec extends RunMapSpec {}

export class ConfigureSpec extends RunMapSpec {}

export class InitializeSpec extends RunMapSpec {}

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
  @jf.string().optional()
  todo?: string;
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
  private services: Service[];

  constructor(
    private fileManager: BboxDiscovery,
    private processManager: ProcessManager,
    private ui: Ui
  ) {
  }

  async init(ctx: Ctx) {
    this.modules = await this.loadAllModules(ctx);
    this.services = [];

    for (const module of this.modules) {
      if (module.bboxModule?.onInit) {
        await module.bboxModule.onInit(this, ctx);
      }

      this.services.push(...Object.values(module.services));
    }

    await this.reloadServiceStates(ctx);
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
      await this.runInteractive(module, params.cmd, {}, ctx);
    } catch (e) {
      console.error(e); // XXX
      throw e;
    }
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

    this.stageStart(service, ctx);

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
    // ctx.stagedStates.forEach((staged) => {
    //   if (staged.service) {
    //     console.log(staged.service); // XXX
    //   }
    //   if (staged.module) {
    //     console.log(staged.module); // XXX
    //   }
    // })
    // process.exit(0);

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
          if (service.state.processStatus !== state.processStatus) {
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

      this.stageBuild(service.module, ctx);
      await this.executeStaged(ctx);

      return await this.processManager.run(service.module, serviceSpec.valueProviders[providerName], serviceSpec.env, ctx);
    } catch (e) {
      throw Error(`Could not get ${valueName} value: ${e.message}`);
    }
  }

  @validateParams()
  async list(params: ListCommandParams, ctx: Ctx) {
    let table = 'Service️| Module | State | Conf. | Built | Init | Runtime | Avail. runtimes\n' +
                '------- | ------ | ----- | ----- | ----- | ---- | --------| ---------------\n';
    for (const service of this.services) {
      const status = await this.getServiceProcessStatus(service, ctx);
      table += `${service.name} | ${service.module.name} | ${status} | ${this.boolToEmoji(service.module.state.configured)}`
        + ` | ${this.boolToEmoji(service.module.state.built)} | ${this.boolToEmoji(service.module.state.initialized)}`
        + ` | ${service.module.runtime} | ${service.module.availableRuntimes.join(', ')}|\n`;
    }
    this.ui.print(table);
  }

  private boolToEmoji(bool: boolean) {
      return bool ? '✔' : ' ';
  }

  async shutdown() {
    await this.processManager.onShutdown();
  }

  private stageStart(service: Service, ctx: Ctx) {
    this.stageInitialize(service.module, ctx);
    this.stageDependenciesIfDefined(service.spec.dependencies, ctx);
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
    throw new Error('N/I');
    this.stageStart(service, ctx);
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

  async provideValues(values: {[key: string]: string}, ctx) {
    const ret = {};
    for (const envName in values) {
      ret[envName] = await this.provideValue(values[envName], ctx);
    }
    return ret;
  }

  private stageConfigure(module: Module, ctx: Ctx) {
    const notRanSteps = this.stageRunMapSpec(module.spec.configure, module.state.configureState, ctx);
    if (!notRanSteps.length) {
      module.state.configured = true;
      return;
    }

    module.state.configured = false;
    this.stageModuleState(module, {configured: true}, ctx);
  }

  private async runConfigure(module: Module, ctx: Ctx) {
    if (!module.spec.configure) {
      throw new Error('Module has not `configure` specified');
    }

    await this.runRunSpec(module, module.spec.configure, module.state.configureState, ctx);

    module.state.configured = true;
    this.fileManager.saveModuleState(module);
  }

  private stageBuild(module: Module, ctx: Ctx) {
    this.stageConfigure(module, ctx);

    const notRanSteps = this.stageRunMapSpec(module.spec.build, module.state.buildState, ctx);
    if (!notRanSteps.length) {
      module.state.built = true;
      return;
    }

    module.state.built = false;
    this.stageModuleState(module, {built: true}, ctx);
  }

  private async runBuild(module: Module, ctx: Ctx) {
    const spec = module.spec.build;
    if (!spec) {
      throw new Error('Module has not `build` specified');
    }

    await this.runRunSpec(module, module.spec.build, module.state.buildState, ctx);

    module.state.built = true;
    this.fileManager.saveModuleState(module);
  }

  private stageInitialize(module: Module, ctx: Ctx) {
    this.stageBuild(module, ctx);

    const notRanSteps = this.stageRunMapSpec(module.spec.initialize, module.state.initializeState, ctx);
    if (!notRanSteps.length) {
      module.state.initialized = true;
      return;
    }

    module.state.initialized = false;
    this.stageModuleState(module, {initialized: true}, ctx);
  }

  private async runInitialize(module: Module, ctx: Ctx) {
    if (!module.spec.initialize) {
      throw new Error('Module has not `configure` specified');
    }

    await this.runRunSpec(module, module.spec.initialize, module.state.initializeState, ctx);

    module.state.initialized = true;
    this.fileManager.saveModuleState(module);
  }

  private stageServiceState(service: Service, state: Partial<ServiceState>, ctx: Ctx) {
    const states = ctx.stagedStates
      .filter((staged) => staged.service && staged.service.service.name === service.name)
      .map((s) => s.service.state);
    const found = find(states, state);
    if (found) {
      return;
    }

    ctx.stagedStates.push({service: {service, state}});
  }

  private stageModuleState(module: Module, state: Partial<ModuleState>, ctx: Ctx) {
    const states = ctx.stagedStates
      .filter((staged) => staged.module && staged.module.module.name === module.name)
      .map((s) => s.module.state);
    const found = find(states, state);
    if (found) {
      return;
    }

    ctx.stagedStates.push({module: {module, state}});
  }

  stageRunMapSpec(runMapSpec: RunMapSpec | undefined, runStateMap: RunStateMap, ctx: Ctx) {
    if (!runMapSpec) {
      return [];
    }

    const notAppliedSteps = this.getNotAppliedSteps(runMapSpec, runStateMap)
    for (const key of notAppliedSteps) {
      const runSpec = runMapSpec[key];
      if (runSpec.prompt) {
        // TODO
        //this.stagePrompt(runSpec.prompt);
      }
      this.stageDependenciesIfDefined(runSpec.dependencies, ctx);
    }

    return notAppliedSteps;
  }

  stageDependenciesIfDefined(dependecies: DependenciesSpec | undefined, ctx: Ctx) {
    if (!dependecies) {
      return;
    }

    for (const dependencySpec of dependecies) {
      const service = this.getService(dependencySpec.service);
      this.stageStart(service, ctx);
    }
  }

  private async runRunSpec(module: Module, runMapSpec: RunMapSpec, runStateMap: RunStateMap, ctx: Ctx) {
    const orderedKeys = Object.keys(runMapSpec).sort();

    for (const key of orderedKeys) {
      const runSpec = runMapSpec[key];
      let runState: RunState = runStateMap[key] ?? {};
      if (runSpec.once && runState.lastRanAt) {
        continue;
      }
      try {
        runState.lastRanAt = new Date().toISOString();

        const env = runSpec.env ?? {};
        if (runSpec.prompt) {
          const promptParams: PromptParams<any> = {
            questions: runSpec.prompt.questions,
            initialAnswers: runState.prompt
          }
          const prompt = await this.ui.prompt(promptParams);
          env['bbox_prompt'] = JSON.stringify(prompt);
          for (const question of runSpec.prompt.questions as ReadonlyArray<any>) {
            if (question.env) {
              env[question.env] = prompt[question.name];
            }
          }

          runState.prompt = prompt;
        }

        await this.runInteractive(module, runSpec.run, env, ctx);

        runStateMap[key] = runState;

        this.fileManager.saveModuleState(module);
      } catch (e) {
        throw e;
      }
    }
  }

  private async runInteractive(module: Module, runnable: RunnableSpec, env: EnvValuesSpec, ctx: Ctx) {
    if (Array.isArray(runnable)) {
      for (const run of runnable) {
        await this.runInteractive(module, run, env, ctx);
      }
      return;
    }

    try {
      if (typeof runnable === 'function') {
        const origEnvs = process.env;
        shelljs.pushd(module.cwdAbsolutePath);
        process.env = {
          ...process.env,
          ...env
        }
        try {
          await runnable({
            bbox: this,
            ctx: ctx,
            module: module
          });
        } finally {
          shelljs.popd();
          process.env = origEnvs;
        }
        return;
      }

      await this.processManager.runInteractive(module, runnable, env, ctx);
    } catch (e) {
      this.ui.print(`**Error when running:** \`${runnable}\``);
      const ret = await this.ui.prompt<{action: 's' | 'c' | 'r'}>({
        questions: [
          {
            type: 'expand', name: 'action', default: 'r', message: 'Re-run, skip, cancel?',
            choices: [
              {name: 'Re-run', value: 'r', key: 'r'},
              {name: 'Skip', value: 's', key: 's'},
              {name: 'Cancel', value: 'c', key: 'c'}
            ]
          }
        ]
      });
      switch (ret.action) {
        case 's':
          break;
        case 'r':
          await this.runInteractive(module, runnable, env, ctx);
        default:
          throw e;
      }
    }
  }

  private getNotAppliedSteps(runMapSpec: RunMapSpec, runStateMap: RunStateMap) {
    console.log(runMapSpec); // XXX
    const orderedKeys = Object.keys(runMapSpec).sort();

    const ret = [];
    for (const key of orderedKeys) {
      const runSpec = runMapSpec[key];
      let runState: RunState = runStateMap[key] ?? {};
      if (runSpec.once && runState.lastRanAt) {
        continue;
      }
      ret.push(key);
    }
    return ret;
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
    const service = this.services.find(service => service.name === serviceName);
    if (service) {
      return service;
    }

    throw new Error(`Service "${serviceName}" not found.`);
  }

  getAllModules() {
    if (!this.modules) {
      throw new Error('Modules not initialized');
    }
    return this.modules;
  }

  private async loadAllModules(ctx: Ctx) {
    const internalModules = await this.fileManager.discoverInternalModules(ctx.projectOpts.rootPath);
    const modules = await this.fileManager.discoverModules(ctx.projectOpts.rootPath);
    modules.push(...internalModules);
    return modules;
  }

  private async reloadServiceStates(ctx: Ctx) {
    for (const service of this.services) {
      service.state.processStatus = await this.getServiceProcessStatus(service, ctx);
    }
  }

  private async getServiceProcessStatus(service: Service, ctx: Ctx): Promise<ServiceProcessStatus> {
    const process = await this.processManager.findServiceProcess(service, ctx);
    switch (process?.status) {
      case ProcessStatus.Running:
        return ServiceProcessStatus.Online;
      case ProcessStatus.NotRunning:
      default:
        return ServiceProcessStatus.Offline;
    }
  }
}

