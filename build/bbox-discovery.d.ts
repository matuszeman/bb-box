import { DependencySpec, Module, Pipeline, Service, Task } from './bbox';
export declare type Dependant = Service | Pipeline | Task;
export declare class DiscoveryCtx {
    modules: Module[];
    depsToResolve: {
        dependant: Dependant;
        spec: DependencySpec;
    }[];
    resolveDependencies(): void;
    getService(name: string): Service;
    getTask(module: string, name: string): Task;
    getPipeline(module: string, name: string): Pipeline;
    getModule(name: string): Module;
}
export declare class BboxDiscovery {
    private bboxFile;
    private bboxFilesGlob;
    private ignore;
    discoverRootPath(currentPath: string): string;
    discoverModules(rootPath: string): Promise<Module[]>;
    discoverInternalModules(projectRootPath: string): Promise<Module[]>;
    saveModuleState(module: Module): void;
    private createModule;
    private createTasks;
    private createPipelines;
    private discoverDependencies;
    private loadJsFileIfExists;
    private loadJsFile;
    private mkdir;
    /**
     * Make sure to pre-create docker volumes otherwise they'll be create with root permissions by docker-compose
     */
    private mkdirDockerVolumes;
    private mkfile;
}
