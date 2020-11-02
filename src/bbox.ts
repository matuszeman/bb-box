import 'source-map-support/register';
import 'reflect-metadata';
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

export type EntityType = 'Module' | 'Service' | 'Pipeline' | 'Task';
export interface Entity {
  type: EntityType;
  name: string;
}

export interface DependantEntity extends Entity {
  dependencies: Dependency[];
}

export class DependencySpec {
  module?: string;
  service?: string;
  state?: string;
  task?: string;
  force?: boolean;
  pipeline?: string;
  env?: string
}
export type DependenciesSpec = DependencySpec[];

export class Dependency {
  origin: Service | Pipeline | Task;
  target: Service | Pipeline | Task;
  spec: DependencySpec;
}

export type EnvValue = string;
export type EnvValuesSpec = {[key: string]: EnvValue | RunnableFn};
export type EnvValues = {[key: string]: EnvValue};

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

export class Service implements DependantEntity {
  type: 'Service';
  name: string;
  module: Module;
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
  returns?: any;
}

export class TasksState {
  [key: string]: TaskState;
}

export class PipelineState {
  ran: boolean;
  lastRanAt?: string;
}

export class PipelinesState {
  [key: string]: PipelineState;
}

export interface ModuleState {
  pipelines: PipelinesState;
  tasks: TasksState;
}

export class TaskSpec {
  // task does not need to have a run defined, it can be used to start dependencies only
  run?: Runnable;
  env?: EnvValuesSpec;
  dependencies?: DependenciesSpec;
  prompt?: PromptParams<any>;
  returns: ({output: any}) => any;
}

export class TasksSpec {
  [name: string]: TaskSpec;
}

export class Task implements DependantEntity {
  type: 'Task';
  name: string;
  module: Module;
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

export class PipelineStepsSpec {
  [stepName: string]: PipelineStepSpec;
}

export class PipelineSpec {
  steps: PipelineStepsSpec;
  dependencies?: DependenciesSpec;
}

export class PipelinesSpec {
  [name: string]: PipelineSpec;
}

export class Pipeline implements DependantEntity {
  type: 'Pipeline';
  name: string;
  module: Module;
  spec: PipelineSpec;
  dependencies: Dependency[];
}

export class Pipelines {
  [name: string]: Pipeline;
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
  pipelines?: PipelinesSpec;
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

export class Module implements Entity {
  type: EntityType = 'Module';
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
  tasks: Tasks;
  pipelines: Pipelines;
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
    hash: string;
    dependency?: Dependency;
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

export class PipelineParams {
  @jf.string().required()
  service: string;
  @jf.string().required()
  pipeline: string;
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
  async pipeline(params: PipelineParams, ctx: Ctx) {
    const service = this.getService(params.service);
    const {pipeline} = this.getPipeline(service.module, params.pipeline);
    this.stagePipeline(pipeline, true, ctx);
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
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const service = this.getService(params.service);

    this.stageStartServiceIfNotStarted(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const service = await this.getService(params.service);

    this.stageAction(ctx, `[${service.module.name}] Stopping ${service.name} service`, `stop_service_${service.name}`, undefined, async () => {
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
  async task(params: RunTaskParams, ctx: Ctx) {
    const service = await this.getService(params.service);
    const module = service.module;
    const task = module.tasks[params.task];
    if (!task) {
      throw new Error(`Task "${task.name}" not found`);
    }

    this.stageRunTask(task, ctx);
    await this.executeStaged(ctx);
  }

  private async executeStaged(ctx: Ctx) {
    // ctx.stagedActions.forEach((staged) => {
    //   console.log(staged.name, staged.dependency); // XXX
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

      //TODO
      await this.executeStaged(ctx);

      const env = await this.getEnvValues(service.module, serviceSpec.env, ctx);
      return await this.processManager.run(service.module, serviceSpec.valueProviders[providerName], env, ctx);
    } catch (e) {
      throw Error(`Could not get ${valueName} value: ${e.message}`);
    }
  }

  @validateParams()
  async status(params: ListCommandParams, ctx: Ctx) {
    let table = 'Service️| Module | State | Runtime | Avail. runtimes\n' +
                '------- | ------ | ----- | --------| ---------------\n';
    for (const service of this.services) {
      const status = await this.getServiceProcessStatus(service, ctx);
      table += `${service.name} | ${service.module.name} | ${status} `
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

  private stageStartServiceIfNotStarted(service: Service, ctx: Ctx, dependency?: Dependency) {
    if (service.state.processStatus === ServiceProcessStatus.Online) {
      return;
    }

    this.stageDependenciesIfDefined(service, ctx);
    this.stageAction(ctx, `[${service.module.name}] Starting ${service.name} service`, `start_service_${service.name}`, dependency, async () => {
      await this.runStartService(service, ctx);
    });
  }

  private async runStartService(service: Service, ctx: Ctx) {
    const envValues = await this.evaluateEnvValues(service.module, service.spec.env, ctx);
    await this.processManager.startAndWaitUntilStarted(service, envValues, ctx);
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
    this.stageStartServiceIfNotStarted(service, ctx);
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

  private stageAction(ctx: Ctx, name: string, hash: string, dependency: Dependency | undefined, run: ActionFn) {
    if (ctx.stagedActions.findIndex((action) => action.hash === hash) !== -1) {
      return;
    }
    ctx.stagedActions.push({run, name, hash, dependency});
  }

  stagePipeline(pipeline: Pipeline, force: boolean, ctx: Ctx, dependency?: Dependency) {
    const module = pipeline.module;
    const {state} = this.getPipeline(module, pipeline.name);

    const notAppliedSteps = this.getNotAppliedSteps(module, pipeline.spec, force);
    if (!force && state.ran && notAppliedSteps.length === 0) {
      return;
    }

    this.stageDependenciesIfDefined(pipeline, ctx);

    for (const stepName of notAppliedSteps) {
      const pipelineStepSpec: PipelineStepSpec = pipeline.spec.steps[stepName];
      const {task} = this.getTask(module, pipelineStepSpec.task);
      const taskSpec = task.spec;
      if (taskSpec.prompt) {
        // TODO
        //this.stagePrompt(runSpec.prompt);
      }
      this.stageDependenciesIfDefined(task, ctx);
    }

    this.stageAction(ctx, `[${pipeline.module.name}] Running pipeline ${pipeline.name}`, `run_pipeline_${module.name}_${pipeline.name}`, undefined, async () => {
      await this.runPipeline(module, pipeline, ctx);
    });
  }

  stageDependenciesIfDefined(dependant: Service | Pipeline | Task, ctx: Ctx) {
    if (!dependant.dependencies) {
      return;
    }

    for (const dependency of dependant.dependencies) {
      const target = dependency.target;

      // if (dependency.spec.env) {
      //   switch (dependant.type) {
      //     case 'Service':
      //       dependant.spec.env[dependency.spec.env] = async (params) => {
      //         params.
      //       }
      //     case 'Task':
      //       dependency.target.spec.env[dependency.spec.env] = returns;
      //   }
      // }

      switch (target.type) {
        case 'Service': {
          this.stageStartServiceIfNotStarted(target, ctx, dependency);
          break;
        }
        case 'Task': {
          const {state} = this.getTask(target.module, target.name);
          if (!state.ran || dependency.spec.force) {
            this.stageRunTask(target, ctx, dependency);
          }
          break;
        }
        case 'Pipeline': {
          const {pipeline, state} = this.getPipeline(target.module, target.name);
          if (!state.ran || dependency.spec.force) {
            this.stagePipeline(pipeline, dependency.spec.force, ctx, dependency);
          }
          break;
        }
      }
    }
  }

  private async runPipeline(module: Module, pipeline: Pipeline, ctx: Ctx) {
    const pipelineSpec = pipeline.spec;
    const steps: PipelineStepsSpec = pipelineSpec.steps;

    const {state} = this.getPipeline(module, pipeline.name);

    const orderedKeys = Object.keys(steps).sort();
    for (const key of orderedKeys) {
      const pipelineStepSpec = steps[key];
      const {task, state} = this.getTask(module, pipelineStepSpec.task);

      if (pipelineStepSpec.once && state.ran) {
        continue;
      }

      await this.runTask(task, ctx);
    }

    state.ran = true;
    state.lastRanAt = new Date().toISOString();
    this.fileManager.saveModuleState(module);
  }

  private stageRunTask(task: Task, ctx: Ctx, dependency?: Dependency) {
    this.stageDependenciesIfDefined(task, ctx);

    this.stageAction(ctx, `[${task.module.name}] Running task ${task.name}`, `run_task_${task.module.name}_${task.name}`, dependency, async () => {
      await this.runTask(task, ctx);
    });
  }

  private async runTask(task: Task, ctx: Ctx) {
    const taskSpec = task.spec;
    const module = task.module;

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

    if (taskSpec.run) {
      const ret = await this.runInteractive(module, taskSpec.run, env, ctx);
      if (ret.returns) {
        state.returns = ret.returns;
      } else if (taskSpec.returns && ret.output) {
        state.returns = taskSpec.returns({output: ret.output});
      }
    }

    if (state.returns) {
      this.ui.print(`__Returns:__`);
      this.ui.print(JSON.stringify(state.returns, null, 2));
    }

    state.ran = true;
    this.fileManager.saveModuleState(module);

    return {
      returns: state.returns
    }
  }

  private async runInteractive(module: Module, runnable: RunnableSpec, envValuesSpec: EnvValuesSpec, ctx: Ctx): Promise<{output?: string, returns?: any}> {
    let output: string = '';
    if (Array.isArray(runnable)) {
      for (const run of runnable) {
        const ret = await this.runInteractive(module, run, envValuesSpec, ctx);
        output += ret.output;
      }
      return {output};
    }

    const env = await this.getEnvValues(module, envValuesSpec, ctx);
    while (true) {
      try {
        if (typeof runnable === 'function') {
          return await this.runFunction(module, runnable, env, ctx);
        }
        const ret = await this.processManager.runInteractive(module, runnable, env, ctx);
        output += ret.output;
        return {output};
      } catch (e) {
        this.ui.print(`**Error when running:** \`${runnable}\``);
        const ret = await this.ui.prompt<{ action: 's' | 'c' | 'r' }>({
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
            return {output: e.output};
            break;
          case 'r':
            // just loop again
            break;
          default:
            throw new Error(`Execution cancelled. Error: ${e.message}`);
        }
      }
    }
  }

  private async getEnvValues(module: Module, env: EnvValuesSpec, ctx) {
    const envSpec = {
      ...module.spec.env,
      ...env
    };
    return this.evaluateEnvValues(module, envSpec, ctx);
  }

  private async evaluateEnvValues(module: Module, envValueSpec: EnvValuesSpec, ctx: Ctx): Promise<EnvValues> {
    const env: EnvValues = {};
    for (const name in envValueSpec) {
      const spec = envValueSpec[name];
      if (typeof spec === 'function') {
        const {returns} = await this.runFunction(module, spec, {}, ctx);
        env[name] = returns;
        continue;
      }
      env[name] = spec;
    }

    return env;
  }

  private async runFunction(module: Module, runnable: RunnableFn, env: EnvValues, ctx: Ctx) {
    const origEnvs = process.env;
    shelljs.pushd(module.cwdAbsolutePath);
    process.env = {
      ...process.env,
      ...env
    }
    try {
      const ret = await runnable({
        bbox: this,
        ctx: ctx,
        module: module
      });
      return {returns: ret};
    } finally {
      shelljs.popd();
      process.env = origEnvs;
    }
  }

  private getNotAppliedSteps(module: Module, pipelineSpec: PipelineSpec, includeAlwaysTasks: boolean): string[] {
    const steps: PipelineStepsSpec = pipelineSpec.steps;

    const orderedKeys = Object.keys(steps).sort();

    const ret = [];
    for (const key of orderedKeys) {
      const pipelineStepSpec = steps[key];
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
      throw new Error(`Task ${task} not found`);
    }
    if (!module.state.tasks[taskName]) {
      module.state.tasks[taskName] = {ran: false};
    }
    return {task, state: module.state.tasks[taskName]};
  }

  private getPipeline(module: Module, name: string) {
    const pipeline = module.pipelines[name];
    if (!pipeline) {
      throw new Error(`Pipeline ${pipeline.name} not found`);
    }
    if (!module.state.pipelines[name]) {
      module.state.pipelines[name] = {ran: false};
    }
    return {pipeline, state: module.state.pipelines[name]};
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

