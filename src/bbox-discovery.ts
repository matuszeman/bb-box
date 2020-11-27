import * as fs from 'fs';
import * as nodePath from 'path';
import * as globby from 'globby';
import {
  BboxModule,
  DependenciesSpec,
  Dependency,
  DependencySpec,
  DockerVolumes,
  DockerVolumesSpec,
  Module,
  ModuleSpec,
  ModuleState,
  Pipeline,
  Pipelines,
  PipelinesSpec,
  Runtime,
  Service,
  ServiceProcessStatus,
  Task,
  Tasks,
  TasksSpec
} from './bbox';
import {BboxError, ErrorCode} from './errors';

export type Dependant = Service | Pipeline | Task;

export class DiscoveryCtx {
  modules: Module[] = [];
  depsToResolve: {dependant: Dependant, spec: DependencySpec}[] = [];

  resolveDependencies() {
    for (const dep of this.depsToResolve) {
      const {spec, dependant} = dep;

      if (!spec.module && !spec.service) {
        // default to dependant/this module if module is not set explicitly
        spec.module = dependant.module.name;
      }

      if (spec.service) {
        const service = this.getService(spec.service);
        dependant.dependencies.push({
          origin: dependant,
          target: service,
          spec
        });
        continue;
      }

      if (spec.task) {
        const task = this.getTask(spec.module, spec.task);
        dependant.dependencies.push({
          origin: dependant,
          target: task,
          spec
        });
        continue;
      }

      if (spec.pipeline) {
        const task = this.getPipeline(spec.module, spec.pipeline);
        dependant.dependencies.push({
          origin: dependant,
          target: task,
          spec
        });
        continue;
      }
    }
  }

  getService(name: string): Service {
    for (const module of this.modules) {
      if (module.services[name]) {
        return module.services[name];
      }
    }
    throw new BboxError(ErrorCode.NotFound, `Service ${name} not found`)
  }

  getTask(module: string, name: string): Task {
    const ret = this.getModule(module).tasks[name];
    if (ret) {
      return ret;
    }
    throw new BboxError(ErrorCode.NotFound, `Task ${name} not found`)
  }

  getPipeline(module: string, name: string): Pipeline {
    const ret = this.getModule(module).pipelines[name];
    if (ret) {
      return ret;
    }
    throw new BboxError(ErrorCode.NotFound, `Pipeline ${name} not found`)
  }

  getModule(name: string) {
    for (const module of this.modules) {
      if (module.name === name) {
        return module;
      }
    }
    throw new BboxError(ErrorCode.NotFound, `Module ${name} not found`)
  }
}

export class BboxDiscovery {
  private bboxFile = 'bbox.js'

  private bboxFilesGlob = [
    this.bboxFile,
    `*/${this.bboxFile}`
  ];

  discoverRootPath(currentPath: string): string {
    let rootPath = undefined;
    while (true) {
      if (fs.existsSync(`${currentPath}/${this.bboxFile}`)) {
        rootPath = currentPath;
      }
      const parentPath = nodePath.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }

    if (!rootPath) {
      throw new Error(`Could not find root ${this.bboxFile} file`);
    }

    return rootPath;
  }

  async discoverModules(rootPath: string): Promise<Module[]> {
    const paths = globby.sync(this.bboxFilesGlob, {
      ignore: ['**/.bbox'],
      cwd: rootPath,
      absolute: true,
      gitignore: true,
      // TODO suppressErrors does not work and still getting EACCESS errors
      suppressErrors: true // to suppress e.g. EACCES: permission denied, scandir
    });
    const ctx = new DiscoveryCtx();
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = nodePath.dirname(moduleFilePath);
        const moduleSpec: ModuleSpec = require(moduleFilePath);
        const module = this.createModule(rootPath, absolutePath, moduleSpec, `${absolutePath}/.bbox`, absolutePath, ctx);
        ctx.modules.push(module);
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    ctx.resolveDependencies();

    return ctx.modules;
  }

  async discoverInternalModules(projectRootPath: string): Promise<Module[]> {
    const rootPath = `${__dirname}/modules`;

    const paths = globby.sync(this.bboxFilesGlob, {
      ignore: ['**/.bbox'],
      cwd: rootPath,
      absolute: true,
      gitignore: true,
      // TODO suppressErrors does not work and still getting EACCESS errors
      suppressErrors: true // to suppress e.g. EACCES: permission denied, scandir
    });
    const ctx = new DiscoveryCtx();
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = nodePath.dirname(moduleFilePath);
        const moduleSpec = this.loadJsFile<ModuleSpec>(moduleFilePath);
        const bboxPath = `${projectRootPath}/.bbox/internal-modules/${moduleSpec.name}`;
        const module = this.createModule(rootPath, absolutePath, moduleSpec, bboxPath, bboxPath, ctx);
        ctx.modules.push(module);
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    ctx.resolveDependencies();

    return ctx.modules;
  }

  saveModuleState(module: Module) {
    fs.writeFileSync(`${module.bboxPath}/state.json`, JSON.stringify(module.state, null, 2));
  }

  private createModule(rootPath: string, absolutePath: string, moduleSpec: ModuleSpec, bboxPath: string, cwdPath: string, ctx: DiscoveryCtx): Module {
    this.mkdir(bboxPath);

    const stateFilePath = `${bboxPath}/state.json`;
    this.mkfile(stateFilePath, '{}');

    const bboxModuleFile = `${absolutePath}/bbox.module.js`;
    const bboxModule = this.loadJsFileIfExists<BboxModule>(bboxModuleFile);

    const statePath = `${bboxPath}/state`;
    this.mkdir(statePath);

    const relPathFromRoot = absolutePath.replace(rootPath, '').slice(1);

    this.mkdir(`${statePath}/docker-volumes`);
    const relDockerVolumesPath = `${relPathFromRoot}/.bbox/state/docker-volumes`;

    const moduleStateFile = this.loadJsFile<Partial<ModuleState>>(stateFilePath);
    // TODO types
    const state: ModuleState = Object.assign<ModuleState, Partial<ModuleState>>({
      tasks: {},
      pipelines: {}
    }, moduleStateFile);

    const module: Module = {
      type: 'Module',
      root: rootPath === absolutePath,
      cwdAbsolutePath: cwdPath,
      name: moduleSpec.name,
      services: {},
      state,
      runtime: moduleSpec.runtime,
      absolutePath,
      path: relPathFromRoot,
      availableRuntimes: [],
      spec: moduleSpec,
      bboxPath: bboxPath,
      bboxModule,
      tasks: {},
      pipelines: {}
    }

    module.tasks = this.createTasks(moduleSpec.tasks, module, ctx);
    module.pipelines = this.createPipelines(moduleSpec.pipelines, module, ctx);

    if (moduleSpec.docker) {
      module.availableRuntimes.push(Runtime.Docker);

      const volumes = this.mkdirDockerVolumes(moduleSpec.docker.volumes, relDockerVolumesPath, relPathFromRoot, rootPath);

      module.docker = {
        volumes
      };
    }

    // Services
    if (moduleSpec.services) {
      for (const serviceName of Object.keys(moduleSpec.services)) {
        const serviceSpec = moduleSpec.services[serviceName];
        if (!serviceSpec.name) {
          serviceSpec.name = serviceName;
        }
        if (!serviceSpec.env) {
          serviceSpec.env = {};
        }
        if (serviceSpec.start && !module.availableRuntimes.includes(Runtime.Local)) {
          module.availableRuntimes.push(Runtime.Local);
        }

        const service: Service = {
          type: 'Service',
          module,
          name: serviceSpec.name,
          spec: serviceSpec,
          state: {
            processStatus: ServiceProcessStatus.Unknown
          },
          dependencies: []
        };

        // resolve dependencies
        this.discoverDependencies(serviceSpec.dependencies, service, ctx);

        if (serviceSpec.docker) {
          // make sure to pre-create docker volumes otherwise they'll be create with root permissions by docker-compose
          const volumes = this.mkdirDockerVolumes(serviceSpec.docker.volumes, relDockerVolumesPath, relPathFromRoot, rootPath);
          service.docker = {
            volumes
          }
        }

        module.services[serviceName] = service;
      }
    }

    if (module.availableRuntimes.length === 0) {
      module.availableRuntimes.push(Runtime.Local);
      //throw new Error(`Module ${module.name} has no available runtime`);
      //console.warn(`Module ${module.spec.name} has no available runtime`);
    }
    if (!module.runtime) {
      module.runtime = module.availableRuntimes[0];
    }

    return module;
  }

  private createTasks(tasksSpec: TasksSpec | undefined, module: Module, ctx: DiscoveryCtx): Tasks {
    if (!tasksSpec) {
      return {};
    }

    const tasks: Tasks = {};
    for (const name of Object.keys(tasksSpec)) {
      const taskSpec = tasksSpec[name];
      const task: Task = {
        type: 'Task',
        name,
        module,
        spec: taskSpec,
        dependencies: []
      };

      this.discoverDependencies(taskSpec.dependencies, task, ctx);

      tasks[name] = task;
    }
    return tasks;
  }

  private createPipelines(pipelinesSpec: PipelinesSpec | undefined, module: Module, ctx: DiscoveryCtx): Pipelines {
    if (!pipelinesSpec) {
      return {};
    }

    const pipelines: Pipelines = {};
    for (const name of Object.keys(pipelinesSpec)) {
      const spec = pipelinesSpec[name];
      const pipeline: Pipeline = {
        type: 'Pipeline',
        name,
        module,
        spec,
        dependencies: []
      };

      this.discoverDependencies(spec.dependencies, pipeline, ctx);

      pipelines[name] = pipeline;
    }
    return pipelines;
  }

  private discoverDependencies(dependenciesSpec: DependenciesSpec, dependant: Dependant, ctx: DiscoveryCtx): Dependency[] {
    if (!dependenciesSpec) {
      return;
    }

    for (const dependencySpecOrig of dependenciesSpec) {
      const dependencySpec = {
        //module: dependant.dependantModule?.name,
        //service: dependant.dependantService?.name,
        ...dependencySpecOrig
      }
      ctx.depsToResolve.push({
        dependant,
        spec: dependencySpec
      });
    }
  }

  private loadJsFileIfExists<T>(path: string): T | undefined {
    if (fs.existsSync(path)) {
      return this.loadJsFile<T>(path);
    }

    return undefined;
  }

  private loadJsFile<T>(path: string): T {
    let file: any = require(path);
    // ts: export default {}
    if (file.default) {
      file = file.default;
    }
    return file;
  }

  private mkdir(path) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, {recursive: true});
    }
  }

  /**
   * Make sure to pre-create docker volumes otherwise they'll be create with root permissions by docker-compose
   */
  private mkdirDockerVolumes(volumesSpec: DockerVolumesSpec | undefined, relVolumesStatePathFromRoot: string, relModulePathFromRoot: string, absRootPath: string): DockerVolumes {
    if (!volumesSpec) {
      return {};
    }

    const oldUmask = process.umask(0);

    const volumes: DockerVolumes = {};
    for (const volumeName in volumesSpec) {
      let volumeSpec = volumesSpec[volumeName];
      let relHostPathFromRoot = `${relVolumesStatePathFromRoot}/${volumeName}`;
      let containerPath;
      if (typeof volumeSpec === 'string') {
        containerPath = volumeSpec;
      } else {
        ({containerPath, hostPath: relHostPathFromRoot} = volumeSpec);
        relHostPathFromRoot = `${relModulePathFromRoot}/${relHostPathFromRoot}`;
      }

      volumes[volumeName] = {
        containerPath,
        hostPath: `./${relHostPathFromRoot}` // must be prefixed with ./ otherwise it's taken as named volume
      };

      this.mkdir(`${absRootPath}/${relHostPathFromRoot}`);
    }

    process.umask(oldUmask);

    return volumes;
  }

  private mkfile(path, content) {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, content);
    }
  }
}
