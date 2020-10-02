import * as fs from 'fs';
import * as nodePath from 'path';
import * as globby from 'globby';
import {BboxModule, Module, ModuleSpec, ModuleState, Runtime, Service, ServiceProcessStatus} from './bbox';

export class BboxDiscovery {
  private bboxFile = 'bbox.js'

  private bboxFilesGlob = [
    this.bboxFile,
    `*/${this.bboxFile}`,
    // 'bbox.config.js',
    // '*/bbox.config.js',
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
    const modules: Module[] = [];
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = nodePath.dirname(moduleFilePath);
        const moduleSpec: ModuleSpec = require(moduleFilePath);
        const module = this.createModule(rootPath, absolutePath, moduleSpec, `${absolutePath}/.bbox`, absolutePath);
        modules.push(module);
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    return modules;
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
    const modules: Module[] = [];
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = nodePath.dirname(moduleFilePath);
        const moduleSpec = this.loadJsFile<ModuleSpec>(moduleFilePath);
        const bboxPath = `${projectRootPath}/.bbox/internal-modules/${moduleSpec.name}`;
        const module = this.createModule(rootPath, absolutePath, moduleSpec, bboxPath, bboxPath);
        modules.push(module);
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    return modules;
  }

  saveModuleState(module: Module) {
    fs.writeFileSync(`${module.bboxPath}/state.json`, JSON.stringify(module.state, null, 2));
  }

  private createModule(rootPath: string, absolutePath: string, moduleSpec: ModuleSpec, bboxPath: string, cwdPath: string): Module {
    if (!fs.existsSync(bboxPath)) {
      fs.mkdirSync(bboxPath, {recursive: true});
    }

    const stateFilePath = `${bboxPath}/state.json`;
    if (!fs.existsSync(stateFilePath)) {
      fs.writeFileSync(stateFilePath, '{}');
    }

    const bboxModuleFile = `${absolutePath}/bbox.module.js`;
    const bboxModule = this.loadJsFileIfExists<BboxModule>(bboxModuleFile);

    const statePath = `${bboxPath}/state`;
    if (!fs.existsSync(statePath)) {
      fs.mkdirSync(statePath, {recursive: true});
    }
    const moduleStateFile = this.loadJsFile<Partial<ModuleState>>(stateFilePath);
    // TODO types
    const state: ModuleState = Object.assign<ModuleState, Partial<ModuleState>>({
      built: false,
      builtOnce: [],
      configured: false,
      configuredOnce: []
    }, moduleStateFile);

    const path = absolutePath.replace(rootPath, '').slice(1);
    const module: Module = {
      root: rootPath === absolutePath,
      cwdAbsolutePath: cwdPath,
      name: moduleSpec.name,
      services: {},
      state,
      runtime: moduleSpec.runtime,
      absolutePath,
      path,
      availableRuntimes: [],
      spec: moduleSpec,
      bboxPath: bboxPath,
      bboxModule
    }

    if (moduleSpec.docker) {
      module.availableRuntimes.push(Runtime.Docker);
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
          module,
          name: serviceSpec.name,
          spec: serviceSpec,
          state: {
            processStatus: ServiceProcessStatus.Unknown
          }
        };
        module.services[serviceName] = service;
      }
    }

    if (module.availableRuntimes.length === 0) {
      //throw new Error(`Module ${module.name} has no available runtime`);
      console.warn(`Module ${module.spec.name} has no available runtime`);
    }
    if (!module.runtime) {
      module.runtime = module.availableRuntimes[0];
    }

    return module;
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
}