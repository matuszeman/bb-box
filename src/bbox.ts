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
import {Listr, ListrContext, ListrTask} from 'listr2';

export interface TaskRunnerCtx {

}

export interface RunnableFnParams {
  bbox: Bbox;
  ctx: Ctx;
  module: Module;
  getTaskReturnValue: (taskName: string, moduleName?: string) => any;
  run: (cmd: string) => Promise<{output: string}>;
}

export type RunnableFn = (params: RunnableFnParams) => Promise<any>;
export type Runnable = string | RunnableFn;
export type RunnableSpec = Runnable | Runnable[];
export type ActionFn = (ctx: Ctx) => Promise<any>;

export type EntityType = 'Module' | 'Service' | 'Pipeline' | 'Task';
export interface Entity {
  type: EntityType;
  name: string;
}

export class HookSpec {
  run?: RunnableSpec;
  env?: EnvValuesSpec;
  resetTasks?: string[];
  resetPipelines?: string[];
  resetPipelinesWithTasks?: string[];
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
  }
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
  returns?: ({output: any}) => any;
  onRan?: HookSpec;
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
  onRan?: HookSpec;
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
  // internal
  onModuleRegistered?: (params: {bbox: Bbox, registeredModule: Module, ctx: Ctx}) => Promise<any>;
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

export class Ctx {
  projectOpts: ProjectOpts
  ui: Ui;
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

export class ListPipelinesParams {
  @jf.string().required()
  service: string;
}

export class TaskParams {
  @jf.string().required()
  service: string;
  @jf.string().required()
  task: string;
}

export class ListTasksParams {
  @jf.string().required()
  service: string;
}

export class ShellParams {
  @jf.string().required()
  service: string;
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
    private processManager: ProcessManager
  ) {
  }

  async init(ctx: Ctx) {
    this.modules = await this.loadAllModules(ctx);

    for (const module of this.modules) {
      if (module.spec.onModuleRegistered) {
        for (const registeredModule of this.modules) {
          if (registeredModule === module) {
            continue;
          }
          await module.spec.onModuleRegistered({bbox: this, registeredModule, ctx});
        }
      }
    }

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

  @validateParams()
  async listPipelines(params: ListPipelinesParams, ctx: Ctx) {
    const service = this.getService(params.service);
    const module = service.module;
    ctx.ui.print(`__${module.name} pipelines:__\n${Object.values(module.pipelines).map(pipeline => `- ${pipeline.name}`).join('\n')}`);
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
  async shell(params: ShellParams, ctx: Ctx) {
    const service = this.getService(params.service);
    const module = service.module;
    await this.runInteractive(module, 'bash', {}, ctx);
  }

  @validateParams()
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const service = this.getService(params.service);

    this.stageStartServiceIfNotStarted(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async restart(params: ServiceCommandParams, ctx: Ctx) {
    const service = this.getService(params.service);

    this.stageStopService(service, ctx);
    this.stageStartService(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const service = await this.getService(params.service);

    this.stageStopService(service, ctx);

    await this.executeStaged(ctx);
  }

  @validateParams()
  async task(params: TaskParams, ctx: Ctx) {
    const service = await this.getService(params.service);
    const module = service.module;
    const task = module.tasks[params.task];
    if (!task) {
      throw new Error(`Task "${params.task}" not found`);
    }

    this.stageRunTask(task, ctx);
    await this.executeStaged(ctx);
  }

  @validateParams()
  async listTasks(params: ListTasksParams, ctx: Ctx) {
    const service = await this.getService(params.service);
    const module = service.module;
    ctx.ui.print(`__${module.name} tasks:__\n${Object.values(module.tasks).map(task => `- ${task.name}`).join('\n')}`);
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
    ctx.ui.print(table);
  }

  private async executeStaged(ctx: Ctx) {
    ctx.ui.print(`# Actions to run:\n${ctx.stagedActions.map((item) => `- ${item.name}`).join('\n')}`);
    //process.exit(0);

    for (const action of ctx.stagedActions) {
      ctx.ui.print(`# ${action.name}`);
      await action.run(ctx);
    }

    // const tasks: ListrTask[] = [];
    // ctx.stagedActions.forEach((staged) => {
    //   tasks.push({
    //     title: staged.name,
    //     task: async (taskCtx, task): Promise<void> => {
    //       //const stdout = task.stdout();
    //       const ui = new Ui({
    //         //stdout: stdout,
    //         // TODO ??? strip didn't work?
    //         //stdoutStripAnsi: true
    //       });
    //
    //       while (true) {
    //         try {
    //           await staged.run({
    //             stagedActions: [],
    //             projectOpts: ctx.projectOpts,
    //             ui
    //           });
    //           return;
    //         } catch (e) {
    //           console.log(e); // XXX
    //           const ret = await ctx.ui.prompt<{ action: 's' | 'c' | 'r' }>({
    //             questions: [
    //               {
    //                 type: 'expand', name: 'action', default: 'r', message: 'Re-run, skip, cancel?',
    //                 choices: [
    //                   {name: 'Re-run', value: 'r', key: 'r'},
    //                   {name: 'Skip', value: 's', key: 's'},
    //                   {name: 'Cancel', value: 'c', key: 'c'}
    //                 ]
    //               }
    //             ]
    //           });
    //           switch (ret.action) {
    //             case 's':
    //               task.skip('TOODO SKIP MESSAGE');
    //               break;
    //             case 'r':
    //               // just loop again
    //               break;
    //             default:
    //               throw new Error(`Execution cancelled. Error: ${e.message}`);
    //           }
    //         }
    //       }
    //     },
    //     options: {
    //       // TODO it does not work with e.g. 10 lines, it breaks rendering and e.g. goes to new line e.g. with "npm i" command
    //       //bottomBar: 1,
    //     }
    //   });
    // });
    //
    // const runner = new Listr<TaskRunnerCtx>(tasks, {
    //   concurrent: false
    // });
    // try {
    //   await runner.run();
    // } finally {
    //   //console.log = origConsoleLog;
    // }

    // for (const action of ctx.stagedActions) {
    //   ctx.ui.print(action.name);
    //   while (true) {
    //     try {
    //       await action.run(ctx);
    //       break;
    //     } catch (e) {
    //       const ret = await ctx.ui.prompt<{ action: 's' | 'c' | 'r' }>({
    //         questions: [
    //           {
    //             type: 'expand', name: 'action', default: 'r', message: 'Re-run, skip, cancel?',
    //             choices: [
    //               {name: 'Re-run', value: 'r', key: 'r'},
    //               {name: 'Skip', value: 's', key: 's'},
    //               {name: 'Cancel', value: 'c', key: 'c'}
    //             ]
    //           }
    //         ]
    //       });
    //       if (ret.action === 'c') {
    //         throw new Error(`Execution cancelled. Error: ${e.message}`);
    //       }
    //       if (ret.action === 's') {
    //         break;
    //       }
    //       if (ret.action === 'r') {
    //         continue;
    //       }
    //       throw new Error(`Unhandled prompt value: ${ret.action}`);
    //     }
    //   }
    // }
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

    this.stageStartService(service, ctx, dependency);
  }

  private stageStartService(service: Service, ctx: Ctx, dependency?: Dependency) {
    this.stageDependenciesIfDefined(service, ctx);
    if (!service.spec.start) {
      return;
    }
    this.stageAction(ctx, `[${service.module.name}] Start ${service.name} service`, `start_service_${service.name}`, dependency, async (ctx) => {
      await this.runStartService(service, ctx);
    });
  }

  private async runStartService(service: Service, ctx: Ctx) {
    const envValues = await this.evaluateEnvValues(service.module, service.spec.env, ctx);
    await this.processManager.startAndWaitUntilStarted(service, envValues, ctx);
  }

  private stageStopService(service: Service, ctx: Ctx) {
    this.stageAction(ctx, `[${service.module.name}] Stop ${service.name} service`, `stop_service_${service.name}`, undefined, async (ctx) => {
      await this.runStopService(service, ctx);
    });
  }

  private async runStopService(service: Service, ctx: Ctx) {
    const envValues = await this.evaluateEnvValues(service.module, service.spec.env, ctx);
    await this.processManager.startAndWaitUntilStarted(service, envValues, ctx);
  }

  private stageAction(ctx: Ctx, name: string, hash: string, dependency: Dependency | undefined, run: ActionFn) {
    if (ctx.stagedActions.findIndex((action) => action.hash === hash) !== -1) {
      return;
    }
    ctx.stagedActions.push({run, name, hash, dependency});
  }

  private stagePipeline(pipeline: Pipeline, force: boolean, ctx: Ctx, dependency?: Dependency) {
    const module = pipeline.module;
    const {state} = this.getPipeline(module, pipeline.name);

    const notAppliedSteps = this.getNotAppliedSteps(module, pipeline.spec, force || !state.ran);
    if (!force && state.ran && notAppliedSteps.length === 0) {
      return;
    }

    this.stageDependenciesIfDefined(pipeline, ctx);

    let isAtLeastOneTaskStaged = false;
    for (const stepName of notAppliedSteps) {
      const pipelineStepSpec: PipelineStepSpec = pipeline.spec.steps[stepName];
      const {task, state} = this.getTask(module, pipelineStepSpec.task);

      if (pipelineStepSpec.once && state.ran) {
        continue;
      }

      const taskSpec = task.spec;
      if (taskSpec.prompt) {
        // this.stageAction(ctx, `[${pipeline.module.name}] Running pipeline ${pipeline.name}`,
        // `prompt_${module.name}_${pipeline.name}`, undefined, async (ctx) => {
        //   await this.runPipeline(module, pipeline, ctx);
        // });
      }

      isAtLeastOneTaskStaged = true;
      this.stageDependenciesIfDefined(task, ctx);
      this.stageRunTask(task, ctx, dependency, pipeline);
    }

    if (isAtLeastOneTaskStaged) {
      let entity = `${pipeline.module.name} / ${pipeline.name}`;
      this.stageAction(ctx, `[${entity}] Storing pipeline state`,
        `run_pipeline_${module.name}_${pipeline.name}`, undefined, async (ctx) => {
          await this.runPipeline(module, pipeline, ctx);
        });
    }
  }

  private stageDependenciesIfDefined(dependant: Service | Pipeline | Task, ctx: Ctx) {
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
    const {state} = this.getPipeline(module, pipeline.name);

    if (pipeline.spec.onRan) {
      await this.runHook(module, pipeline.spec.onRan, ctx);
    }

    state.ran = true;
    state.lastRanAt = new Date().toISOString();
    this.fileManager.saveModuleState(module);
  }

  private stageRunTask(task: Task, ctx: Ctx, dependency?: Dependency, pipeline?: Pipeline) {
    this.stageDependenciesIfDefined(task, ctx);

    let entity = task.module.name;
    if (pipeline) {
      entity += ` / ${pipeline.name}`;
    }

    this.stageAction(ctx, `[${entity}] Running task ${task.name}`,
      `run_task_${task.module.name}_${task.name}`, dependency, async (ctx) => {
      await this.runTask(task, ctx);
    });

    if (task.spec.onRan) {
      this.stageAction(ctx, `[${entity}] Running task ${task.name} hook: onRan`,
        `run_task_hook_onRan_${task.module.name}_${task.name}`, dependency, async (ctx) => {
          await this.runHook(task.module, task.spec.onRan, ctx);
      });
    }
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
        initialAnswers: state.prompt
      }
      const prompt = await ctx.ui.prompt(promptParams);
      env['bbox_prompt'] = JSON.stringify(prompt);
      for (const question of taskSpec.prompt.questions as ReadonlyArray<any>) {
        if (question.env) {
          env[question.env] = prompt[question.name];
        }
      }

      state.prompt = prompt;
      this.fileManager.saveModuleState(module);
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
      ctx.ui.print(`__Returns:__`);
      ctx.ui.print(JSON.stringify(state.returns, null, 2));
    }

    state.ran = true;
    this.fileManager.saveModuleState(module);

    return {
      returns: state.returns
    }
  }

  private async runHook(module: Module, hookSpec: HookSpec, ctx: Ctx) {
    if (hookSpec.resetTasks) {
      ctx.ui.print(`__Resetting tasks:__ ${hookSpec.resetTasks.join(', ')}`);
      for (const taskName of hookSpec.resetTasks) {
        const {state} = this.getTask(module, taskName);
        state.ran = false;
      }
    }
    if (hookSpec.resetPipelines) {
      ctx.ui.print(`__Resetting pipelines:__ ${hookSpec.resetPipelines.join(', ')}`);
      for (const pipelineName of hookSpec.resetPipelines) {
        const {state} = this.getPipeline(module, pipelineName);
        state.ran = false;
      }
    }
    if (hookSpec.resetPipelinesWithTasks) {
      ctx.ui.print(`__Resetting pipelines with tasks:__ ${hookSpec.resetPipelinesWithTasks.join(', ')}`);
      for (const pipelineName of hookSpec.resetPipelinesWithTasks) {
        const {state} = this.getPipeline(module, pipelineName);
        state.ran = false;

        for (const stepName of Object.keys(module.pipelines[pipelineName].spec.steps)) {
          const taskName = module.pipelines[pipelineName].spec.steps[stepName].task;
          const {state} = this.getTask(module, taskName);
          state.ran = false;
        }
      }
    }
    if (hookSpec.run) {
      await this.runInteractive(module, hookSpec.run, hookSpec.env, ctx);
    }
    this.fileManager.saveModuleState(module);
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
          ctx.ui.print(`__Running:__ [function]`);
          return await this.runFunction(module, runnable, env, ctx);
        }
        ctx.ui.print(`__Running:__ \`${runnable}\``);
        const ret = await this.processManager.runInteractive(module, runnable, env, ctx);
        output += ret.output;
        return {output};
      } catch (e) {
        // TODO until stagePipeline is not implemented to stage tasks too, we need to have this here,
        // TODO otherwise skip would cancel whole pipeline in #executeStaged
        ctx.ui.print(`**Error when running:** \`${runnable}\``);
        ctx.ui.print(e.message);
        const ret = await ctx.ui.prompt<{ action: 's' | 'c' | 'r' }>({
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
    shelljs.pushd('-q', module.cwdAbsolutePath);
    process.env = {
      ...process.env,
      ...env
    }
    try {
      const ret = await runnable({
        bbox: this,
        ctx: ctx,
        module: module,
        getTaskReturnValue: (taskName: string, moduleName?: string) => {
          let taskModule = moduleName ? this.getModule(moduleName) : module;
          const {state} = this.getTask(taskModule, taskName);
          if (typeof state.returns === 'undefined') {
            throw new Error(`No return value for task ${taskName} in module ${moduleName}`);
          }
          return state.returns;
        },
        run: async (cmd: string) => {
          const ret = await this.runInteractive(module, cmd, process.env, ctx);
          return {output: ret.output};
        },
      });
      return {returns: ret};
    } finally {
      shelljs.popd('-q');
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
      throw new Error(`Task ${taskName} not found.`);
    }
    if (!module.state.tasks[taskName]) {
      module.state.tasks[taskName] = {ran: false};
    }
    return {task, state: module.state.tasks[taskName]};
  }

  private getPipeline(module: Module, name: string) {
    const pipeline = module.pipelines[name];
    if (!pipeline) {
      throw new Error(`Pipeline ${name} not found`);
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
      throw new Error(`Module "${name}" not found. Available modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  getService(serviceName: string) {
    const service = this.services.find(service => service.name === serviceName);
    if (service) {
      return service;
    }

    throw new Error(`Service "${serviceName}" not found. Available services: ${this.services.map((service) => service.name).join(', ')}`);
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

