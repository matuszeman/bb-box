import 'source-map-support/register';
import 'reflect-metadata';
import * as shell from 'shelljs';
export interface RunnableFnOpts {
    module: Module;
}
declare type Runnable = string | string[];
declare type Dependency = string;
declare enum ServiceProcessStatus {
    Unknown = "Unknown",
    Online = "Online"
}
export interface SubService {
    name: string;
    port?: number;
    containerPort?: number;
}
export interface Service {
    name: string;
    port?: number;
    containerPort?: number;
    start?: string;
    subServices?: {
        [key: string]: SubService;
    };
    process: {
        status: ServiceProcessStatus;
    };
    env?: {
        [key: string]: any;
    };
    dependencies?: Dependency[];
}
export declare enum Command {
    Build = "Build"
}
export declare enum Runtime {
    Local = "Local",
    DockerCompose = "DockerCompose"
}
export interface ModuleState {
    ranMigrations: string[];
    built: boolean;
}
export interface ModuleFile {
    name: string;
    services: Service[];
    build?: Runnable;
    migrations?: {
        [key: string]: Runnable;
    };
}
export interface Module extends ModuleFile {
    absolutePath: string;
    availableRuntimes: Runtime[];
    runtime: Runtime;
    state: ModuleState;
    services: Service[];
}
export interface Ctx {
    projectOpts: ProjectOpts;
}
export declare class ServiceCommandParams {
    services: string[];
}
export declare class RunCommandParams {
    runnable: string;
}
export declare class ProxyBuildParams {
    todo?: string;
}
export declare class ListCommandParams {
    mode?: string;
}
export declare function commandMethod(params?: {
    paramsType?: any;
}): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export declare class BboxOpts {
    rootPath: string;
}
export declare class ProjectOpts {
    rootPath: string;
    reverseProxy: {
        port: number;
    };
    domain: string;
    proxyConfigPath: string;
    dockerComposeOverridePath: string;
}
export declare class Bbox {
    private opts;
    private fileManager;
    private runner;
    private processManager;
    private projectOpts;
    constructor(opts: BboxOpts, fileManager: FileManager, runner: Runner, processManager: ProcessManager);
    init(): Promise<void>;
    test(params: ServiceCommandParams): Promise<void>;
    proxyBuild(params: ProxyBuildParams): Promise<void>;
    run(params: RunCommandParams): Promise<void>;
    build(params: ServiceCommandParams): Promise<void>;
    start(params: ServiceCommandParams): Promise<void>;
    stop(params: ServiceCommandParams): Promise<void>;
    migrate(params: ServiceCommandParams): Promise<void>;
    list(params: ListCommandParams): Promise<void>;
    shutdown(): Promise<void>;
    private ctx;
    private runStart;
    runStartDependenciesIfNeeded(module: Module, service: Service, ctx: Ctx): Promise<void>;
    private runRestartApp;
    private runBuild;
    private runMigrate;
    private runBuildIfNeeded;
    private runMigrationsIfNeeded;
    private getNotAppliedMigrations;
    private getModule;
    private getModuleForService;
    private getService;
    private reloadServiceProcesses;
    private eachService;
    private getAllModules;
    private setProxyForwardForServiceIfNeeded;
    private unsetProxyForwardForServiceIfNeeded;
}
export declare class FileManager {
    discoverRootPath(currentPath: string): string;
    discoverModules(path: string): Promise<Module[]>;
    saveState(module: Module): void;
}
export declare class Runner {
    run(module: Module, runnable: Runnable, ctx: Ctx): Promise<void>;
    private runDockerCompose;
    private runShellCmd;
    private spawn;
    private createExecOpts;
    get shell(): typeof shell;
}
export declare class Process {
    name: string;
    status: string;
}
export declare class ProcessList {
    processes: Process[];
}
export declare class ProcessManager {
    private pm2;
    start(module: Module, service: Service, ctx: Ctx): Promise<void>;
    sendDataToService(module: Module, service: Service): Promise<void>;
    onShutdown(): Promise<void>;
    restart(module: Module, service: Service, ctx: Ctx): Promise<void>;
    stop(module: Module, service: Service, ctx: Ctx): Promise<void>;
    getProcessList(): Promise<ProcessList>;
    private pm2ProcessToBboxProcess;
    private pm2Connect;
    private pm2Disconnect;
}
export {};
