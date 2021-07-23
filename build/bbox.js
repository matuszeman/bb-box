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
exports.Bbox = exports.ProjectOpts = exports.validateParams = exports.ListCommandParams = exports.ShellParams = exports.TaskOrListTasksParams = exports.ListTasksParams = exports.TaskParams = exports.PipelineOrListPipelinesParams = exports.ListPipelinesParams = exports.PipelineParams = exports.RunCommandParams = exports.ServiceCommandParams = exports.Ctx = exports.Module = exports.ModuleDocker = exports.ModuleSpec = exports.DockerVolumesSpec = exports.Pipelines = exports.Pipeline = exports.PipelinesSpec = exports.PipelineSpec = exports.PipelineStepsSpec = exports.PipelineStepSpec = exports.Tasks = exports.Task = exports.CronTabSpec = exports.TasksSpec = exports.TaskSpec = exports.PipelinesState = exports.PipelineState = exports.TasksState = exports.TaskState = exports.Runtime = exports.Service = exports.ServiceDocker = exports.ServiceProcessStatus = exports.Dependency = exports.DependencySpec = exports.HookSpec = void 0;
require("source-map-support/register");
require("reflect-metadata");
const jf = require("joiful");
const pretty_joi_1 = require("./pretty-joi");
const process_manager_1 = require("./process-manager");
const shelljs = require("shelljs");
class HookSpec {
}
exports.HookSpec = HookSpec;
class DependencySpec {
}
exports.DependencySpec = DependencySpec;
class Dependency {
}
exports.Dependency = Dependency;
var ServiceProcessStatus;
(function (ServiceProcessStatus) {
    ServiceProcessStatus["Unknown"] = "Unknown";
    ServiceProcessStatus["Online"] = "Online";
    ServiceProcessStatus["Offline"] = "Offline";
})(ServiceProcessStatus = exports.ServiceProcessStatus || (exports.ServiceProcessStatus = {}));
class ServiceDocker {
}
exports.ServiceDocker = ServiceDocker;
class Service {
}
exports.Service = Service;
var Runtime;
(function (Runtime) {
    Runtime["Local"] = "Local";
    Runtime["Docker"] = "Docker";
})(Runtime = exports.Runtime || (exports.Runtime = {}));
class TaskState {
}
exports.TaskState = TaskState;
class TasksState {
}
exports.TasksState = TasksState;
class PipelineState {
}
exports.PipelineState = PipelineState;
class PipelinesState {
}
exports.PipelinesState = PipelinesState;
class TaskSpec {
}
exports.TaskSpec = TaskSpec;
class TasksSpec {
}
exports.TasksSpec = TasksSpec;
class CronTabSpec {
}
exports.CronTabSpec = CronTabSpec;
class Task {
}
exports.Task = Task;
class Tasks {
}
exports.Tasks = Tasks;
class PipelineStepSpec {
}
exports.PipelineStepSpec = PipelineStepSpec;
class PipelineStepsSpec {
}
exports.PipelineStepsSpec = PipelineStepsSpec;
class PipelineSpec {
}
exports.PipelineSpec = PipelineSpec;
class PipelinesSpec {
}
exports.PipelinesSpec = PipelinesSpec;
class Pipeline {
}
exports.Pipeline = Pipeline;
class Pipelines {
}
exports.Pipelines = Pipelines;
class DockerVolumesSpec {
}
exports.DockerVolumesSpec = DockerVolumesSpec;
class ModuleSpec {
}
exports.ModuleSpec = ModuleSpec;
class ModuleDocker {
}
exports.ModuleDocker = ModuleDocker;
class Module {
    constructor() {
        this.type = 'Module';
    }
}
exports.Module = Module;
class Ctx {
}
exports.Ctx = Ctx;
class ServiceCommandParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], ServiceCommandParams.prototype, "service", void 0);
exports.ServiceCommandParams = ServiceCommandParams;
class RunCommandParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], RunCommandParams.prototype, "module", void 0);
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], RunCommandParams.prototype, "cmd", void 0);
exports.RunCommandParams = RunCommandParams;
class PipelineParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], PipelineParams.prototype, "service", void 0);
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], PipelineParams.prototype, "pipeline", void 0);
exports.PipelineParams = PipelineParams;
class ListPipelinesParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], ListPipelinesParams.prototype, "service", void 0);
exports.ListPipelinesParams = ListPipelinesParams;
class PipelineOrListPipelinesParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], PipelineOrListPipelinesParams.prototype, "service", void 0);
__decorate([
    jf.string(),
    __metadata("design:type", String)
], PipelineOrListPipelinesParams.prototype, "pipeline", void 0);
exports.PipelineOrListPipelinesParams = PipelineOrListPipelinesParams;
class TaskParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], TaskParams.prototype, "service", void 0);
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], TaskParams.prototype, "task", void 0);
exports.TaskParams = TaskParams;
class ListTasksParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], ListTasksParams.prototype, "service", void 0);
exports.ListTasksParams = ListTasksParams;
class TaskOrListTasksParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], TaskOrListTasksParams.prototype, "service", void 0);
__decorate([
    jf.string(),
    __metadata("design:type", String)
], TaskOrListTasksParams.prototype, "task", void 0);
exports.TaskOrListTasksParams = TaskOrListTasksParams;
class ShellParams {
}
__decorate([
    jf.string().required(),
    __metadata("design:type", String)
], ShellParams.prototype, "service", void 0);
exports.ShellParams = ShellParams;
class ListCommandParams {
}
__decorate([
    jf.string().allow(''),
    __metadata("design:type", String)
], ListCommandParams.prototype, "mode", void 0);
exports.ListCommandParams = ListCommandParams;
function validateParams(params = {}) {
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
exports.validateParams = validateParams;
class ProjectOpts {
}
exports.ProjectOpts = ProjectOpts;
class Bbox {
    constructor(fileManager, processManager) {
        this.fileManager = fileManager;
        this.processManager = processManager;
    }
    async init(ctx) {
        var _a;
        this.modules = await this.loadAllModules(ctx);
        for (const module of this.modules) {
            if (module.spec.onModuleRegistered) {
                for (const registeredModule of this.modules) {
                    if (registeredModule === module) {
                        continue;
                    }
                    await module.spec.onModuleRegistered({ bbox: this, registeredModule, ctx });
                }
            }
        }
        this.services = [];
        for (const module of this.modules) {
            if ((_a = module.bboxModule) === null || _a === void 0 ? void 0 : _a.onInit) {
                await module.bboxModule.onInit(this, ctx);
            }
            this.services.push(...Object.values(module.services));
        }
        await this.reloadServiceStates(ctx);
    }
    async onCliInit(cli, ctx) {
        var _a;
        for (const module of this.modules) {
            if ((_a = module.bboxModule) === null || _a === void 0 ? void 0 : _a.onCliInit) {
                await module.bboxModule.onCliInit(this, cli, ctx);
            }
        }
    }
    async pipeline(params, ctx) {
        const service = this.getService(params.service);
        const { pipeline } = this.getPipeline(service.module, params.pipeline);
        this.stagePipeline(pipeline, true, ctx);
        await this.executeStaged(ctx);
    }
    async listPipelines(params, ctx) {
        const service = this.getService(params.service);
        const module = service.module;
        ctx.ui.print(`__${module.name} pipelines:__\n${Object.values(module.pipelines).map(pipeline => `- ${pipeline.name}`).join('\n')}`);
    }
    async pipelineOrListPipelines(params, ctx) {
        if (params.pipeline) {
            return this.pipeline({
                pipeline: params.pipeline,
                service: params.service
            }, ctx);
        }
        return this.listPipelines({
            service: params.service
        }, ctx);
    }
    async run(params, ctx) {
        const module = this.getModule(params.module);
        try {
            await this.runInteractive(module, params.cmd, {}, ctx);
        }
        catch (e) {
            console.error(e); // XXX
            throw e;
        }
    }
    async shell(params, ctx) {
        const service = this.getService(params.service);
        const module = service.module;
        await this.runInteractive(module, 'bash', {}, ctx);
    }
    async start(params, ctx) {
        const service = this.getService(params.service);
        this.stageStartServiceIfNotStarted(service, ctx);
        await this.executeStaged(ctx);
    }
    async restart(params, ctx) {
        const service = this.getService(params.service);
        this.stageStopService(service, ctx);
        this.stageStartService(service, ctx);
        await this.executeStaged(ctx);
    }
    async stop(params, ctx) {
        const service = await this.getService(params.service);
        this.stageStopService(service, ctx);
        await this.executeStaged(ctx);
    }
    async task(params, ctx) {
        const service = await this.getService(params.service);
        const module = service.module;
        const task = module.tasks[params.task];
        if (!task) {
            throw new Error(`Task "${params.task}" not found`);
        }
        this.stageRunTask(task, ctx);
        await this.executeStaged(ctx);
    }
    async listTasks(params, ctx) {
        const service = await this.getService(params.service);
        const module = service.module;
        ctx.ui.print(`__${module.name} tasks:__\n${Object.values(module.tasks).map(task => `- ${task.name}`).join('\n')}`);
    }
    async taskOrListTasks(params, ctx) {
        if (params.task) {
            return this.task({
                task: params.task,
                service: params.service
            }, ctx);
        }
        return this.listTasks({
            service: params.service
        }, ctx);
    }
    async status(params, ctx) {
        let table = 'Service️| Module | State | Runtime | Avail. runtimes\n' +
            '------- | ------ | ----- | --------| ---------------\n';
        for (const service of this.services) {
            const status = await this.getServiceProcessStatus(service, ctx);
            table += `${service.name} | ${service.module.name} | ${status} `
                + ` | ${service.module.runtime} | ${service.module.availableRuntimes.join(', ')}|\n`;
        }
        ctx.ui.print(table);
    }
    async executeStaged(ctx) {
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
    boolToEmoji(bool) {
        return bool ? '✔' : ' ';
    }
    async shutdown() {
        await this.processManager.onShutdown();
    }
    stageStartServiceIfNotStarted(service, ctx, dependency) {
        if (service.state.processStatus === ServiceProcessStatus.Online) {
            return;
        }
        this.stageStartService(service, ctx, dependency);
    }
    stageStartService(service, ctx, dependency) {
        this.stageDependenciesIfDefined(service, ctx);
        if (service.module.runtime === Runtime.Local && !service.spec.start) {
            return;
        }
        this.stageAction(ctx, `[${service.module.name}] Start ${service.name} service`, `start_service_${service.name}`, dependency, async (ctx) => {
            await this.runStartService(service, ctx);
        });
    }
    async runStartService(service, ctx) {
        const envValues = await this.evaluateEnvValues(service.module, service.spec.env, ctx);
        await this.processManager.startAndWaitUntilStarted(service, envValues, ctx);
    }
    stageStopService(service, ctx) {
        this.stageAction(ctx, `[${service.module.name}] Stop ${service.name} service`, `stop_service_${service.name}`, undefined, async (ctx) => {
            await this.runStopService(service, ctx);
        });
    }
    async runStopService(service, ctx) {
        await this.processManager.stopAndWaitUntilStopped(service, ctx);
    }
    stageAction(ctx, name, hash, dependency, run) {
        if (ctx.stagedActions.findIndex((action) => action.hash === hash) !== -1) {
            return;
        }
        ctx.stagedActions.push({ run, name, hash, dependency });
    }
    stagePipeline(pipeline, force, ctx, dependency) {
        const module = pipeline.module;
        const { state } = this.getPipeline(module, pipeline.name);
        const notAppliedSteps = this.getNotAppliedSteps(module, pipeline.spec, force || !state.ran);
        if (!force && state.ran && notAppliedSteps.length === 0) {
            return;
        }
        this.stageDependenciesIfDefined(pipeline, ctx);
        let isAtLeastOneTaskStaged = false;
        for (const stepName of notAppliedSteps) {
            const pipelineStepSpec = pipeline.spec.steps[stepName];
            const { task, state } = this.getTask(module, pipelineStepSpec.task);
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
            this.stageAction(ctx, `[${entity}] Storing pipeline state`, `run_pipeline_${module.name}_${pipeline.name}`, undefined, async (ctx) => {
                await this.runPipeline(module, pipeline, ctx);
            });
        }
    }
    stageDependenciesIfDefined(dependant, ctx) {
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
                    const { state } = this.getTask(target.module, target.name);
                    if (!state.ran || dependency.spec.force) {
                        this.stageRunTask(target, ctx, dependency);
                    }
                    break;
                }
                case 'Pipeline': {
                    const { pipeline, state } = this.getPipeline(target.module, target.name);
                    if (!state.ran || dependency.spec.force) {
                        this.stagePipeline(pipeline, dependency.spec.force, ctx, dependency);
                    }
                    break;
                }
                default:
                    throw new Error(`Dependency target type not supported`);
            }
        }
    }
    async runPipeline(module, pipeline, ctx) {
        const { state } = this.getPipeline(module, pipeline.name);
        if (pipeline.spec.onRan) {
            await this.runHook(module, pipeline.spec.onRan, ctx);
        }
        state.ran = true;
        state.lastRanAt = new Date().toISOString();
        this.fileManager.saveModuleState(module);
    }
    stageRunTask(task, ctx, dependency, pipeline) {
        this.stageDependenciesIfDefined(task, ctx);
        let entity = task.module.name;
        if (pipeline) {
            entity += ` / ${pipeline.name}`;
        }
        this.stageAction(ctx, `[${entity}] Running task ${task.name}`, `run_task_${task.module.name}_${task.name}`, dependency, async (ctx) => {
            await this.runTask(task, ctx);
        });
        if (task.spec.onRan) {
            this.stageAction(ctx, `[${entity}] Running task ${task.name} hook: onRan`, `run_task_hook_onRan_${task.module.name}_${task.name}`, dependency, async (ctx) => {
                await this.runHook(task.module, task.spec.onRan, ctx);
            });
        }
    }
    async runTask(task, ctx) {
        var _a;
        const taskSpec = task.spec;
        const module = task.module;
        const { state } = this.getTask(module, task.name);
        state.lastRanAt = new Date().toISOString();
        const env = (_a = taskSpec.env) !== null && _a !== void 0 ? _a : {};
        if (taskSpec.prompt) {
            const promptParams = {
                questions: taskSpec.prompt.questions,
                initialAnswers: state.prompt
            };
            const prompt = await ctx.ui.prompt(promptParams);
            env['bbox_prompt'] = JSON.stringify(prompt);
            for (const question of taskSpec.prompt.questions) {
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
            }
            else if (taskSpec.returns && ret.output) {
                state.returns = taskSpec.returns({ output: ret.output });
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
        };
    }
    async runHook(module, hookSpec, ctx) {
        if (hookSpec.resetTasks) {
            ctx.ui.print(`__Resetting tasks:__ ${hookSpec.resetTasks.join(', ')}`);
            for (const taskName of hookSpec.resetTasks) {
                const { state } = this.getTask(module, taskName);
                state.ran = false;
            }
        }
        if (hookSpec.resetPipelines) {
            ctx.ui.print(`__Resetting pipelines:__ ${hookSpec.resetPipelines.join(', ')}`);
            for (const pipelineName of hookSpec.resetPipelines) {
                const { state } = this.getPipeline(module, pipelineName);
                state.ran = false;
            }
        }
        if (hookSpec.resetPipelinesWithTasks) {
            ctx.ui.print(`__Resetting pipelines with tasks:__ ${hookSpec.resetPipelinesWithTasks.join(', ')}`);
            for (const pipelineName of hookSpec.resetPipelinesWithTasks) {
                const { state } = this.getPipeline(module, pipelineName);
                state.ran = false;
                for (const stepName of Object.keys(module.pipelines[pipelineName].spec.steps)) {
                    const taskName = module.pipelines[pipelineName].spec.steps[stepName].task;
                    const { state } = this.getTask(module, taskName);
                    state.ran = false;
                }
            }
        }
        if (hookSpec.run) {
            await this.runInteractive(module, hookSpec.run, hookSpec.env, ctx);
        }
        this.fileManager.saveModuleState(module);
    }
    async runInteractive(module, runnable, envValuesSpec, ctx) {
        let output = '';
        if (Array.isArray(runnable)) {
            for (const run of runnable) {
                const ret = await this.runInteractive(module, run, envValuesSpec, ctx);
                output += ret.output;
            }
            return { output };
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
                return { output };
            }
            catch (e) {
                // TODO until stagePipeline is not implemented to stage tasks too, we need to have this here,
                // TODO otherwise skip would cancel whole pipeline in #executeStaged
                ctx.ui.print(`**Error when running:** \`${runnable}\``);
                ctx.ui.print(e.message);
                const ret = await ctx.ui.prompt({
                    questions: [
                        {
                            type: 'expand', name: 'action', default: 'r', message: 'Re-run, skip, cancel?',
                            choices: [
                                { name: 'Re-run', value: 'r', key: 'r' },
                                { name: 'Skip', value: 's', key: 's' },
                                { name: 'Cancel', value: 'c', key: 'c' }
                            ]
                        }
                    ]
                });
                switch (ret.action) {
                    case 's':
                        return { output: e.output };
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
    async getEnvValues(module, env, ctx) {
        const envSpec = Object.assign(Object.assign({}, module.spec.env), env);
        return this.evaluateEnvValues(module, envSpec, ctx);
    }
    async evaluateEnvValues(module, envValueSpec, ctx) {
        const env = {};
        for (const name in envValueSpec) {
            const spec = envValueSpec[name];
            if (typeof spec === 'function') {
                const { returns } = await this.runFunction(module, spec, {}, ctx);
                env[name] = returns;
                continue;
            }
            env[name] = spec;
        }
        return env;
    }
    async runFunction(module, runnable, env, ctx) {
        const origEnvs = process.env;
        shelljs.pushd('-q', module.cwdAbsolutePath);
        process.env = Object.assign(Object.assign({}, process.env), env);
        try {
            const ret = await runnable({
                bbox: this,
                ctx: ctx,
                module: module,
                getTaskReturnValue: (taskName, moduleName) => {
                    let taskModule = moduleName ? this.getModule(moduleName) : module;
                    const { state } = this.getTask(taskModule, taskName);
                    if (typeof state.returns === 'undefined') {
                        throw new Error(`No return value for task ${taskName} in module ${moduleName}`);
                    }
                    return state.returns;
                },
                run: async (cmd) => {
                    const ret = await this.runInteractive(module, cmd, process.env, ctx);
                    return { output: ret.output };
                },
            });
            return { returns: ret };
        }
        finally {
            shelljs.popd('-q');
            process.env = origEnvs;
        }
    }
    getNotAppliedSteps(module, pipelineSpec, includeAlwaysTasks) {
        const steps = pipelineSpec.steps;
        const orderedKeys = Object.keys(steps).sort();
        const ret = [];
        for (const key of orderedKeys) {
            const pipelineStepSpec = steps[key];
            const { state } = this.getTask(module, pipelineStepSpec.task);
            if (!state.ran // never ran tasks
                || includeAlwaysTasks && !pipelineStepSpec.once // include not-once tasks
            ) {
                ret.push(key);
            }
        }
        return ret;
    }
    getTask(module, taskName) {
        const task = module.tasks[taskName];
        if (!task) {
            throw new Error(`Task ${taskName} not found.`);
        }
        if (!module.state.tasks[taskName]) {
            module.state.tasks[taskName] = { ran: false };
        }
        return { task, state: module.state.tasks[taskName] };
    }
    getPipeline(module, name) {
        const pipeline = module.pipelines[name];
        if (!pipeline) {
            throw new Error(`Pipeline ${name} not found`);
        }
        if (!module.state.pipelines[name]) {
            module.state.pipelines[name] = { ran: false };
        }
        return { pipeline, state: module.state.pipelines[name] };
    }
    getModule(name) {
        const modules = this.getAllModules();
        const module = modules.find((module) => module.name === name);
        if (!module) {
            throw new Error(`Module "${name}" not found. Available modules: ${modules.map(m => m.name).join(', ')}`);
        }
        return module;
    }
    getService(serviceName) {
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
    async loadAllModules(ctx) {
        const internalModules = await this.fileManager.discoverInternalModules(ctx.projectOpts.rootPath);
        const modules = await this.fileManager.discoverModules(ctx.projectOpts.rootPath);
        modules.push(...internalModules);
        return modules;
    }
    async reloadServiceStates(ctx) {
        for (const service of this.services) {
            service.state.processStatus = await this.getServiceProcessStatus(service, ctx);
        }
    }
    async getServiceProcessStatus(service, ctx) {
        const process = await this.processManager.findServiceProcess(service, ctx);
        switch (process === null || process === void 0 ? void 0 : process.status) {
            case process_manager_1.ProcessStatus.Running:
                return ServiceProcessStatus.Online;
            case process_manager_1.ProcessStatus.NotRunning:
            default:
                return ServiceProcessStatus.Offline;
        }
    }
}
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PipelineParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "pipeline", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListPipelinesParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "listPipelines", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PipelineOrListPipelinesParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "pipelineOrListPipelines", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ShellParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "shell", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "start", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "restart", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceCommandParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "stop", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TaskParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "task", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListTasksParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "listTasks", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TaskOrListTasksParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "taskOrListTasks", null);
__decorate([
    validateParams(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListCommandParams, Ctx]),
    __metadata("design:returntype", Promise)
], Bbox.prototype, "status", null);
exports.Bbox = Bbox;
//# sourceMappingURL=bbox.js.map