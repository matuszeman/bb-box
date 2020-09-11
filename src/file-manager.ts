import * as fs from "fs";
import * as nodePath from "path";
import * as globby from 'globby';
import {Module, ModuleFile, ModuleState, Runtime} from './bbox';

export class FileManager {
  discoverRootPath(currentPath: string): string {
    let rootPath = undefined;
    while (true) {
      if (fs.existsSync(`${currentPath}/bbox.config.js`)) {
        rootPath = currentPath;
      }
      const parentPath = nodePath.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }

    if (!rootPath) {
      throw new Error('Could not find root bbox.config.js');
    }

    return rootPath;
  }

  async discoverModules(path: string): Promise<Module[]> {
    const paths = globby.sync([
      'bbox.config.js',
      '*/bbox.config.js',
    ], {
      ignore: ['**/.bbox'],
      cwd: path,
      absolute: true,
      gitignore: true,
      // TODO suppressErrors does not work and still getting EACCESS errors
      suppressErrors: true // to suppress e.g. EACCES: permission denied, scandir
    });
    const modules: Module[] = [];
    for (const moduleFilePath of paths) {
      try {
        const absolutePath = nodePath.dirname(moduleFilePath);
        const moduleFile: ModuleFile = require(moduleFilePath);

        const stateFilePath = `${absolutePath}/.bbox/state.json`;
        if (!fs.existsSync(stateFilePath)) {
          fs.writeFileSync(stateFilePath, '{}');
        }

        const statePath = `${absolutePath}/.bbox/state`;
        if (!fs.existsSync(statePath)) {
          fs.mkdirSync(statePath, {recursive: true});
        }
        const moduleStateFile: Partial<ModuleState> = require(stateFilePath);
        // TODO types
        const state: ModuleState = Object.assign<ModuleState, Partial<ModuleState>>({
          ranMigrations: [],
          built: false
        }, moduleStateFile);
        // moduleFile.services = moduleFile.services.map<Service>((serviceFile) => {
        //   return Object.assign({
        //     env: {}
        //   }, serviceFile)
        // });
        const module: Module = Object.assign({
          absolutePath,
          state,
          services: [],
          availableRuntimes: [],
          runtime: undefined
        }, moduleFile)

        if (module.docker) {
          module.availableRuntimes.push(Runtime.Docker);
        }

        // Services
        if (module.services) {
          for (const serviceName of Object.keys(module.services)) {
            const service = module.services[serviceName];
            if (!service.env) {
              service.env = {};
            }
            if (!service.name) {
              service.name = serviceName;
            }
            if (service.start && !module.availableRuntimes.includes(Runtime.Local)) {
              module.availableRuntimes.push(Runtime.Local);
            }
          }
        }

        modules.push(module);
      } catch (e) {
        throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
      }
    }

    for (const module of modules) {
      if (module.availableRuntimes.length === 0) {
        //throw new Error(`Module ${module.name} has no available runtime`);
        console.warn(`Module ${module.name} has no available runtime`);
      }
      if (!module.runtime) {
        module.runtime = module.availableRuntimes[0];
      }
    }

    return modules;
  }

  saveState(module: Module) {
    fs.writeFileSync(`${module.absolutePath}/.bbox/state.json`, JSON.stringify(module.state, null, 2));
  }
}
