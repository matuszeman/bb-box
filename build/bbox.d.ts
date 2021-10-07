import 'source-map-support/register';
import 'reflect-metadata';
import { WaitOnOptions } from 'wait-on';
import { ProcessManager } from './process-manager';
import { BboxDiscovery } from './bbox-discovery';
import { PromptParams, Ui } from './ui';
import { Cli } from './cli';
export interface RunnableFnParams {
    bbox: Bbox;
    ctx: Ctx;
    module: Module;
    getTaskReturnValue: (taskName: string, moduleName?: string) => any;
    run: (cmd: string) => Promise<{
        output: string;
    }>;
}
export declare type RunnableFn = (params: RunnableFnParams) => Promise<any>;
export declare type Runnable = string | RunnableFn;
export declare type RunnableSpec = Runnable | Runnable[];
export declare type ActionFn = (ctx: Ctx) => Promise<any>;
export declare type EntityType = 'Module' | 'Service' | 'Pipeline' | 'Task';
export interface Entity {
    type: EntityType;
    name: string;
}
export declare class HookSpec {
    run?: RunnableSpec;
    env?: EnvValuesSpec;
    resetTasks?: string[];
    resetPipelines?: string[];
    resetPipelinesWithTasks?: string[];
}
export interface DependantEntity extends Entity {
    dependencies: Dependency[];
}
export declare class DependencySpec {
    module?: string;
    service?: string;
    state?: string;
    task?: string;
    force?: boolean;
    pipeline?: string;
    env?: string;
}
export declare type DependenciesSpec = DependencySpec[];
export declare class Dependency {
    origin: Service | Pipeline | Task;
    target: Service | Pipeline | Task;
    spec: DependencySpec;
}
export declare type EnvValue = string;
export declare type EnvValuesSpec = {
    [key: string]: EnvValue | RunnableFn;
};
export declare type EnvValues = {
    [key: string]: EnvValue;
};
export declare enum ServiceProcessStatus {
    Unknown = "Unknown",
    Online = "Online",
    Offline = "Offline"
}
export interface SubServiceSpec {
    name: string;
    port?: number;
    containerPort?: number;
}
export declare class ServiceDocker {
    volumes: DockerVolumes;
}
export interface ServiceSpec {
    name?: string;
    port?: number;
    containerPort?: number;
    start?: string;
    /**
     * https://pm2.keymetrics.io/docs/usage/pm2-api/#programmatic-api
     */
    pm2Options?: {
        minUptime?: number;
    };
    subServices?: {
        [key: string]: SubServiceSpec;
    };
    docker?: {
        volumes?: DockerVolumesSpec;
    };
    env?: EnvValuesSpec;
    provideEnvValues?: {
        [key: string]: string;
    };
    dependencies?: DependenciesSpec;
    healthCheck?: {
        waitOn: WaitOnOptions;
    };
}
export interface ServiceState {
    processStatus: ServiceProcessStatus;
}
export declare class Service implements DependantEntity {
    type: 'Service';
    name: string;
    module: Module;
    spec: ServiceSpec;
    state: ServiceState;
    docker?: ServiceDocker;
    dependencies: Dependency[];
}
export declare enum Runtime {
    Local = "Local",
    Docker = "Docker"
}
export declare class TaskState {
    ran: boolean;
    lastRanAt?: string;
    prompt?: {
        [key: string]: any;
    };
    returns?: any;
}
export declare class TasksState {
    [key: string]: TaskState;
}
export declare class PipelineState {
    ran: boolean;
    lastRanAt?: string;
}
export declare class PipelinesState {
    [key: string]: PipelineState;
}
export interface ModuleState {
    pipelines: PipelinesState;
    tasks: TasksState;
}
export declare class TaskSpec {
    run?: Runnable;
    env?: EnvValuesSpec;
    dependencies?: DependenciesSpec;
    prompt?: PromptParams<any>;
    returns?: ({ output: any }: {
        output: any;
    }) => any;
    onRan?: HookSpec;
}
export declare class TasksSpec {
    [name: string]: TaskSpec;
}
export declare class Task implements DependantEntity {
    type: 'Task';
    name: string;
    module: Module;
    spec: TaskSpec;
    dependencies: Dependency[];
}
export declare class Tasks {
    [name: string]: Task;
}
export declare class PipelineStepSpec {
    task: string;
    once?: boolean;
}
export declare class PipelineStepsSpec {
    [stepName: string]: PipelineStepSpec;
}
export declare class PipelineSpec {
    steps: PipelineStepsSpec;
    dependencies?: DependenciesSpec;
    onRan?: HookSpec;
}
export declare class PipelinesSpec {
    [name: string]: PipelineSpec;
}
export declare class Pipeline implements DependantEntity {
    type: 'Pipeline';
    name: string;
    module: Module;
    spec: PipelineSpec;
    dependencies: Dependency[];
}
export declare class Pipelines {
    [name: string]: Pipeline;
}
export declare class DockerVolumesSpec {
    [key: string]: string | {
        containerPath: string;
        hostPath: string;
    };
}
export declare class ModuleSpec {
    name: string;
    docker?: {
        image?: string;
        file?: string;
        volumes?: DockerVolumesSpec;
    };
    services: {
        [key: string]: ServiceSpec;
    };
    runtime?: Runtime;
    pipelines?: PipelinesSpec;
    tasks?: TasksSpec;
    env?: {
        [key: string]: any;
    };
    onModuleRegistered?: (params: {
        bbox: Bbox;
        registeredModule: Module;
        ctx: Ctx;
    }) => Promise<any>;
}
export declare type DockerVolumes = {
    [name: string]: {
        containerPath: string;
        hostPath: string;
    };
};
export declare class ModuleDocker {
    volumes: DockerVolumes;
}
export declare class Module implements Entity {
    type: EntityType;
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
    services: {
        [name: string]: Service;
    };
    tasks: Tasks;
    pipelines: Pipelines;
}
export interface BboxModule {
    onInit?(bbox: Bbox, ctx: Ctx): Promise<any>;
    onCliInit?(bbox: Bbox, cli: Cli, ctx: Ctx): Promise<any>;
    beforeStart?(bbox: Bbox, ctx: Ctx): Promise<any>;
    beforeStatus?(bbox: Bbox, ctx: Ctx): Promise<any>;
}
export declare class Ctx {
    projectOpts: ProjectOpts;
    ui: Ui;
    stagedActions: {
        run: ActionFn;
        name: string;
        hash: string;
        dependency?: Dependency;
    }[];
}
export declare class ServiceCommandParams {
    service: string;
}
export declare class RunCommandParams {
    module: string;
    cmd: string;
}
export declare class PipelineParams {
    service: string;
    pipeline: string;
}
export declare class ListPipelinesParams {
    service: string;
}
export declare class PipelineOrListPipelinesParams {
    service: string;
    pipeline: string;
}
export declare class TaskParams {
    service: string;
    task: string;
}
export declare class ListTasksParams {
    service: string;
}
export declare class TaskOrListTasksParams {
    service: string;
    task?: string;
}
export declare class ShellParams {
    service: string;
}
export declare class ListCommandParams {
    mode?: string;
}
export declare function validateParams(params?: {
    paramsType?: any;
}): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export declare class ProjectOpts {
    rootPath: string;
    dockerComposePath: string;
}
export declare class Bbox {
    private fileManager;
    private processManager;
    private modules;
    private services;
    constructor(fileManager: BboxDiscovery, processManager: ProcessManager);
    init(ctx: Ctx): Promise<void>;
    onCliInit(cli: Cli, ctx: Ctx): Promise<void>;
    test(params: ServiceCommandParams, ctx: Ctx): Promise<void>;
    pipeline(params: PipelineParams, ctx: Ctx): Promise<void>;
    listPipelines(params: ListPipelinesParams, ctx: Ctx): Promise<void>;
    pipelineOrListPipelines(params: PipelineOrListPipelinesParams, ctx: Ctx): Promise<void>;
    run(params: RunCommandParams, ctx: Ctx): Promise<void>;
    shell(params: ShellParams, ctx: Ctx): Promise<void>;
    start(params: ServiceCommandParams, ctx: Ctx): Promise<void>;
    restart(params: ServiceCommandParams, ctx: Ctx): Promise<void>;
    stop(params: ServiceCommandParams, ctx: Ctx): Promise<void>;
    task(params: TaskParams, ctx: Ctx): Promise<void>;
    listTasks(params: ListTasksParams, ctx: Ctx): Promise<void>;
    taskOrListTasks(params: TaskOrListTasksParams, ctx: Ctx): Promise<void>;
    status(params: ListCommandParams, ctx: Ctx): Promise<void>;
    private executeStaged;
    private boolToEmoji;
    shutdown(): Promise<void>;
    private stageStartServiceIfNotStarted;
    private stageStartService;
    private runStartService;
    private stageStopService;
    private runStopService;
    private stageAction;
    private stagePipeline;
    private stageDependenciesIfDefined;
    private runPipeline;
    private stageRunTask;
    private runTask;
    private runHook;
    private runInteractive;
    private getEnvValues;
    private evaluateEnvValues;
    private runFunction;
    private getNotAppliedSteps;
    private getTask;
    private getPipeline;
    getModule(name: string): Module;
    getService(serviceName: string): Service;
    getAllModules(): Module[];
    private loadAllModules;
    private reloadServiceStates;
    private getServiceProcessStatus;
}
