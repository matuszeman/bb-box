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
export type ActionFn = () => Promise<any>;

export type DependencySpec = {module?: string, service?: string, state?: string, task?: string, force?: boolean};
export type DependenciesSpec = DependencySpec[];

export class Dependency {
  spec: DependencySpec;
}

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
  name?: string;
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
  env?: EnvValuesSpec,
  provideEnvValues?: {[key: string]: string},
  dependencies?: DependenciesSpec,
  healthCheck?: {
    // https://www.npmjs.com/package/wait-on#nodejs-api-usage
    waitOn: WaitOnOptions
  },
  valueProviders?: {[key: string]: string}
  values?: {[key: string]: any}
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
  dependencies: Dependency[];
}

export enum Runtime {
  Local = 'Local',
  Docker = 'Docker'
}

export class TaskState {
  ran: boolean;
  lastRanAt?: string;
  prompt?: {[key: string]: any};
}

export class TasksState {
  [key: string]: TaskState;
}

export interface ModuleState {
  built: boolean;
  configured: boolean;
  initialized: boolean;
  tasks: TasksState;
}

export class TaskSpec {
  run: Runnable;
  env?: EnvValuesSpec;
  dependencies?: DependenciesSpec;
  prompt?: PromptParams<any>;
}

export class TasksSpec {
  [name: string]: TaskSpec;
}

export class Task {
  name: string;
  spec: TaskSpec;
  dependencies: Dependency[]
}

export class Tasks {
  [name: string]: Task
}

export class PipelineStepSpec {
  task: string;
  once?: boolean;
}

export class PipelineSpec {
  [stepName: string]: PipelineStepSpec;
}

export class BuildSpec extends PipelineSpec {}

export class ConfigureSpec extends PipelineSpec {}

export class InitializeSpec extends PipelineSpec {}

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
  tasks?: TasksSpec;
  //migrations?: {[key: string]: RunnableSpec};
  env?: {[key: string]: any};
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
  services: {[name: string]: Service};
  tasks?: Tasks;
}

export interface BboxModule {
  onInit?(bbox: Bbox, ctx: Ctx): Promise<any>;
  onCliInit?(bbox: Bbox, cli: Cli, ctx: Ctx): Promise<any>;
  beforeStart?(bbox: Bbox, ctx: Ctx): Promise<any>;
  beforeStatus?(bbox: Bbox, ctx: Ctx): Promise<any>;
}

export interface Ctx {
  projectOpts: ProjectOpts
  stagedActions: {
    run: ActionFn;
    name: string;
  }[];
}

export class ServiceCommandParams {
  @jf.string().required()
  service: string
}

export class RunCommandParams {
  @jf.string().required()
  module: string;
  @jf.string().required()
  cmd: string;
}

export class ConfigureParams {
  @jf.string().required()
  service: string;
}

export class InitializeParams {
  @jf.string().required()
  service: string;
}

export class BuildParams {
  @jf.string().required()
  service: string;
}

export class RunTaskParams {
  @jf.string().required()
  service: string;
  @jf.string().required()
  task: string;
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
    const service = this.getService(params.service);
    this.stageConfigure(service.module, true, ctx);
    await this.executeStaged(ctx);
  }

  @validateParams()
  async initialize(params: InitializeParams, ctx: Ctx) {
    const service = this.getService(params.service);
    this.stageInitialize(service.module, true, ctx);
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
  async build(params: BuildParams, ctx: Ctx) {
    const service = this.getService(params.service);

    await this.stageBuild(service.module, true, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const service = this.getService(params.service);

    this.stageStart(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const service = await this.getService(params.service);

    this.stageAction(ctx, `Stopping ${service.name}`, async () => {
      await this.processManager.stopAndWaitUntilStopped(service, ctx);
    });

    await this.executeStaged(ctx);
  }

  @validateParams()
  async value(params: ServiceCommandParams, ctx: Ctx) {
    const ret = await this.provideValue(params.service, ctx);
    console.log(ret); // XXX
  }

  @validateParams()
  async runTask(params: RunTaskParams, ctx: Ctx) {
    const service = await this.getService(params.service);
    const module = service.module;
    const task = module.tasks[params.task];
    if (!task) {
      throw new Error(`Task "${task.name}" not found`);
    }

    this.stageRunTask(module, task, ctx);
    await this.executeStaged(ctx);
  }

  private async executeStaged(ctx: Ctx) {
    // ctx.stagedStates.forEach((staged) => {
    //   console.log(staged); // XXX
    // })
    // process.exit(0);

    for (const action of ctx.stagedActions) {
      this.ui.print(action.name);
      await action.run();
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

      this.stageBuild(service.module, false, ctx);
      await this.executeStaged(ctx);

      return await this.processManager.run(service.module, serviceSpec.valueProviders[providerName], serviceSpec.env, ctx);
    } catch (e) {
      throw Error(`Could not get ${valueName} value: ${e.message}`);
    }
  }

  @validateParams()
  async status(params: ListCommandParams, ctx: Ctx) {
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
    this.stageInitialize(service.module, false, ctx);
    this.stageDependenciesIfDefined(service.dependencies, ctx);
    this.stageAction(ctx, `Starting ${service.name}`, async () => {
      await this.processManager.startAndWaitUntilStarted(service, ctx);
    });
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

  private stageConfigure(module: Module, force: boolean, ctx: Ctx) {
    const notRanSteps = this.stagePipelineSpec(module, module.spec.configure, force, ctx);
    if (!notRanSteps.length) {
      module.state.configured = true;
      return;
    }

    this.stageAction(ctx, `Configuring ${module.name}`, async () => {
      await this.runConfigure(module, ctx);
    });
  }

  private async runConfigure(module: Module, ctx: Ctx) {
    if (!module.spec.configure) {
      throw new Error('Module has not `configure` specified');
    }

    await this.runPipeline(module, module.spec.configure, ctx);

    module.state.configured = true;
    this.fileManager.saveModuleState(module);
  }

  private stageBuild(module: Module, force: boolean, ctx: Ctx) {
    this.stageConfigure(module, false, ctx);

    const notRanSteps = this.stagePipelineSpec(module, module.spec.build, force, ctx);
    if (!notRanSteps.length) {
      module.state.built = true;
      return;
    }

    this.stageAction(ctx, `Building ${module.name}`, async () => {
      await this.runBuild(module, ctx);
    });
  }

  private async runBuild(module: Module, ctx: Ctx) {
    const spec = module.spec.build;
    if (!spec) {
      throw new Error('Module has not `build` specified');
    }

    await this.runPipeline(module, module.spec.build, ctx);

    module.state.built = true;
    this.fileManager.saveModuleState(module);
  }

  private stageInitialize(module: Module, force: boolean, ctx: Ctx) {
    this.stageBuild(module, false, ctx);
    const notRanSteps = this.stagePipelineSpec(module, module.spec.initialize, force, ctx);
    if (!notRanSteps.length) {
      module.state.initialized = true;
      return;
    }

    this.stageAction(ctx, `Initializing ${module.name}`, async () => {
      await this.runInitialize(module, ctx);
    });
  }

  private async runInitialize(module: Module, ctx: Ctx) {
    if (!module.spec.initialize) {
      throw new Error('Module has not `configure` specified');
    }

    await this.runPipeline(module, module.spec.initialize, ctx);

    module.state.initialized = true;
    this.fileManager.saveModuleState(module);
  }

  // private stageTaskState(module: Module, task: Task, state: Partial<TaskState>, ctx: Ctx) {
  //   const states = ctx.stagedActions
  //     .filter((staged) => staged.task && staged.task.module.name === module.name && staged.task.task.name === task.name)
  //     .map((s) => s.task.state);
  //   const found = find(states, state);
  //   if (found) {
  //     return;
  //   }
  //
  //   ctx.stagedActions.push({task: {module, task, state}});
  // }
  //
  // private stageServiceState(service: Service, state: Partial<ServiceState>, ctx: Ctx) {
  //   const states = ctx.stagedActions
  //     .filter((staged) => staged.service && staged.service.service.name === service.name)
  //     .map((s) => s.service.state);
  //   const found = find(states, state);
  //   if (found) {
  //     return;
  //   }
  //
  //   ctx.stagedActions.push({service: {service, state}});
  // }
  //
  // private stageModuleState(module: Module, state: Partial<ModuleState>, ctx: Ctx) {
  //   const states = ctx.stagedActions
  //     .filter((staged) => staged.module && staged.module.module.name === module.name)
  //     .map((s) => s.module.state);
  //   const found = find(states, state);
  //   if (found) {
  //     return;
  //   }
  //
  //   ctx.stagedActions.push({module: {module, state}});
  // }

  private stageAction(ctx: Ctx, name: string, run: ActionFn) {
    ctx.stagedActions.push({run, name});
  }

  stagePipelineSpec(module: Module, pipelineSpec: PipelineSpec | undefined, runAlwaysTasks: boolean, ctx: Ctx) {
    if (!pipelineSpec) {
      return [];
    }

    const notAppliedSteps = this.getNotAppliedSteps(module, pipelineSpec, runAlwaysTasks)
    for (const stepName of notAppliedSteps) {
      const pipelineStepSpec: PipelineStepSpec = pipelineSpec[stepName];
      const {task} = this.getTask(module, pipelineStepSpec.task);
      const taskSpec = task.spec;
      if (taskSpec.prompt) {
        // TODO
        //this.stagePrompt(runSpec.prompt);
      }
      this.stageDependenciesIfDefined(task.dependencies, ctx);
    }

    return notAppliedSteps;
  }

  stageDependenciesIfDefined(dependecies: Dependency[] | undefined, ctx: Ctx) {
    if (!dependecies) {
      return;
    }

    for (const dependency of dependecies) {
      const dependencySpec = dependency.spec;

      if (dependencySpec.task) {
        const module = this.getModule(dependencySpec.module);
        const {task, state} = this.getTask(module, dependencySpec.task);
        if (!state.ran || dependencySpec.force) {
          this.stageRunTask(module, task, ctx);
        }
        continue;
      }

      const service = this.getService(dependencySpec.service);
      this.stageStart(service, ctx);
    }
  }

  private async runPipeline(module: Module, pipelineSpec: PipelineSpec, ctx: Ctx) {
    const orderedKeys = Object.keys(pipelineSpec).sort();

    for (const key of orderedKeys) {
      const pipelineStepSpec = pipelineSpec[key];
      const {task, state} = this.getTask(module, pipelineStepSpec.task);

      if (pipelineStepSpec.once && state.ran) {
        continue;
      }

      await this.runTaskInt(module, task, ctx);
    }
  }

  private stageRunTask(module: Module, task: Task, ctx: Ctx) {
    this.stageDependenciesIfDefined(task.dependencies, ctx);

    this.stageAction(ctx, `Running task ${task.name} [${module.name}]`, async () => {
      await this.runTaskInt(module, task, ctx);
    });
  }

  private async runTaskInt(module: Module, task: Task, ctx: Ctx) {
    const taskSpec = task.spec;

    const {state} = this.getTask(module, task.name);

    state.lastRanAt = new Date().toISOString();

    const env = taskSpec.env ?? {};
    if (taskSpec.prompt) {
      const promptParams: PromptParams<any> = {
        questions: taskSpec.prompt.questions,
        initialAnswers: taskSpec.prompt
      }
      const prompt = await this.ui.prompt(promptParams);
      env['bbox_prompt'] = JSON.stringify(prompt);
      for (const question of taskSpec.prompt.questions as ReadonlyArray<any>) {
        if (question.env) {
          env[question.env] = prompt[question.name];
        }
      }

      taskSpec.prompt = prompt;
    }

    await this.runInteractive(module, taskSpec.run, env, ctx);

    state.ran = true;
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

  private getNotAppliedSteps(module: Module, pipelineSpec: PipelineSpec, includeAlwaysTasks: boolean): string[] {
    const orderedKeys = Object.keys(pipelineSpec).sort();

    const ret = [];
    for (const key of orderedKeys) {
      const pipelineStepSpec = pipelineSpec[key];
      const {state} = this.getTask(module, pipelineStepSpec.task);
      if (
        !state.ran // never ran tasks
        || includeAlwaysTasks && !pipelineStepSpec.once // include not-once tasks
      ) {
        ret.push(key);
      }
    }
    return ret;
  }

  private getTask(module: Module, taskName: string) {
    const task = module.tasks[taskName];
    if (!task) {
      throw new Error(`Pipeline task ${task} not found`);
    }
    if (!module.state.tasks[taskName]) {
      module.state.tasks[taskName] = {ran: false};
    }
    return {task, state: module.state.tasks[taskName]};
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

