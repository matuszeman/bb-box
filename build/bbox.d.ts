import * as shell from 'shelljs';
import { StartOptions } from 'pm2';
export interface RunnableFnOpts {
    module: Module;
}
declare type RunnableFn = (RunnableFnOpts: any) => Promise<any>;
declare type Runnable = string | string[] | RunnableFn | RunnableFn[];
export interface App extends StartOptions {
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
    apps: App[];
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
}
export interface Ctx {
}
export declare class ServiceCommandParams {
    services: string[];
}
export declare class ListCommandParams {
    mode?: string;
}
export declare function commandMethod(params?: {
    paramsType?: any;
}): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export declare class Bbox {
    private opts;
    private fileManager;
    private runner;
    private processManager;
    constructor(opts: {
        cwd: string;
    }, fileManager: FileManager, runner: Runner, processManager: ProcessManager);
    build(params: ServiceCommandParams): Promise<void>;
    start(params: ServiceCommandParams): Promise<void>;
    stop(params: ServiceCommandParams): Promise<void>;
    migrate(params: ServiceCommandParams): Promise<void>;
    list(params: ListCommandParams): Promise<void>;
    shutdown(): Promise<void>;
    runStart(module: Module, appName: string, ctx: Ctx): Promise<void>;
    runRestartApp(module: Module, appName: string, ctx: Ctx): Promise<void>;
    runBuild(module: Module, ctx: Ctx): Promise<void>;
    runMigrate(module: Module, ctx: Ctx): Promise<{
        state?: Partial<ModuleState>;
    }>;
    private runDockerCompose;
    spawn(cmd: any, args: any, opts: any): void;
    private runBuildIfNeeded;
    private runMigrationsIfNeeded;
    private getNotAppliedMigrations;
    private getModule;
    private getModuleForService;
    private getService;
    private getAllModules;
    private getRunner;
}
export declare class FileManager {
    discoverModules(path: string): Promise<Module[]>;
    saveState(module: Module): void;
}
export declare class Runner {
    run(module: Module, runnable: Runnable, ctx: Ctx): Promise<void>;
    private runShellCmd;
    private createExecOpts;
    get shell(): typeof shell;
}
export declare class ProcessManager {
    private pm2;
    start(app: App): Promise<void>;
    onShutdown(): Promise<void>;
    restart(app: App): Promise<void>;
    stop(app: App): Promise<void>;
    private pm2Connect;
    private pm2Disconnect;
}
export {};
