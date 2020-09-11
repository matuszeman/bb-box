import 'source-map-support/register';
import 'reflect-metadata';

import { difference } from 'lodash';
import * as fs from 'fs';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import * as YAML from 'yamljs'
import {ProxyConfig} from './proxy-server';
import {WaitOnOptions} from 'wait-on';
import {ProcessList, ProcessManager} from './process-manager';
import {FileManager} from './file-manager';

export interface RunnableFnOpts {
  module: Module;
}

//type RunnableFn = (RunnableFnOpts) => Promise<any>;
//type Runnable = string | string[] | RunnableFn | RunnableFn[];
type Runnable = string | string[];
type Dependency = string;
export type EnvValues = {[key: string]: any};

enum ServiceProcessStatus {
  Unknown = 'Unknown',
  Online = 'Online'
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
    [key: string]: SubService
  }
  env: EnvValues,
  provideEnvValues?: {[key: string]: string},
  dependencies?: Dependency[],
  healthCheck?: {
    // https://www.npmjs.com/package/wait-on#nodejs-api-usage
    waitOn: WaitOnOptions
  },
  valueProviders?: {[key: string]: string}
  values?: {[key: string]: any}
}

export enum Command {
  Build = 'Build'
}

export enum Runtime {
  Local = 'Local',
  Docker = 'Docker'
}

export interface ModuleState {
  ranMigrations: string[];
  built: boolean;
}

export interface ModuleFile {
  name: string;
  docker?: {
    image?: string;
    file?: string;
    volumes?: {
      [key: string]: string
    }
  },
  services: {[key: string]: Service};
  build?: Runnable;
  migrations?: {[key: string]: Runnable};
  env?: {[key: string]: any}
}

export interface Module extends ModuleFile {
  absolutePath: string;
  availableRuntimes: Runtime[],
  runtime: Runtime;
  state: ModuleState;
  services: {[key: string]: Service};
}

export interface Ctx {
  projectOpts: ProjectOpts,
  processList: ProcessList
}

export class ServiceCommandParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class RunCommandParams {
  @jf.string().required()
  runnable: string;
}

export class ConfigureParams {
  @jf.string().allow('')
  todo?: string;
}

export class ShellParams {
  @jf.array().required().items(joi => joi.string()).min(1).max(1)
  services: string[]
}

export class ListCommandParams {
  @jf.string().allow('')
  mode?: string;
}

export function commandMethod(params: {paramsType?: any} = {}) {
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
  proxyConfigPath: string;
  dockerComposePath: string;
  reverseProxy: {
    port: number
  };
  domain: string;
}

export class Bbox {
  constructor(
    private fileManager: FileManager,
    private processManager: ProcessManager
  ) {
  }

  async init(ctx: Ctx) {
    const rootBboxPath = `${ctx.projectOpts.rootPath}/.bbox`;
    if (!fs.existsSync(rootBboxPath)) {
      fs.mkdirSync(rootBboxPath);
    }
  }

  @commandMethod()
  async test(params: ServiceCommandParams, ctx: Ctx) {
    //const {module, service} = await this.getService(params.services[0]);
    //console.log(module, service); // XXX
    //await this.processManager.sendDataToService(module, service);
  }

  @commandMethod()
  async configure(params: ConfigureParams, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);

    const proxyServices: {name: string, port?: number, domainName: string, ip: string}[] = [];
    for (const module of modules) {
      for (const service of Object.values(module.services)) {
        if (service.port) {
          proxyServices.push({name: service.name, port: service.port, domainName: `${service.name}.${ctx.projectOpts.domain}`, ip: '172.17.0.1'});
        }
        if (service.subServices) {
          for (const subServiceKey of Object.keys(service.subServices)) {
            const subService = service.subServices[subServiceKey];
            proxyServices.push({
              name: `${service.name}-${subService.name}`, port: subService.port,
              domainName: `${subService.name}.${service.name}.${ctx.projectOpts.domain}`, ip: '172.17.0.1'
            });
          }
        }
      }
    }

    const forward = {};
    for (const proxyService of proxyServices) {
      if (proxyService.port) {
        const destination = `http://localhost:${proxyService.port}`;
        forward[proxyService.domainName] = destination;
        //forward[proxyService.name] = destination;
      }
    }

    const proxyConfig: ProxyConfig = {
      port: ctx.projectOpts.reverseProxy.port,
      forward
    }
    fs.writeFileSync(ctx.projectOpts.proxyConfigPath, JSON.stringify(proxyConfig, null, 2));

    // docker
    if (fs.existsSync(ctx.projectOpts.dockerComposePath)) {
      fs.unlinkSync(ctx.projectOpts.dockerComposePath);
    }

    const overwrite = {version: '3', services: {}};

    const dockerComposeModules = modules.filter((module) => module.availableRuntimes.includes(Runtime.Docker));

    const extra_hosts = [];
    for (const service of proxyServices) {
      //extra_hosts.push(`${service.name}:${service.ip}`);
      extra_hosts.push(`${service.domainName}:${service.ip}`);
    }
    for (const module of dockerComposeModules) {
      // TODO this should be module folder name
      const moduleFolderName = module.name;
      const moduleFolderPath = `./${moduleFolderName}`;

      const dockerService: any = {};

      if (module.docker?.image) {
        dockerService.image = module.docker.image;
      }

      if (module.docker?.file) {
        // TODO use project name instead of "bbox"
        dockerService.image = `bbox-${module.name}`;
        dockerService.build = {
          context: `./${moduleFolderName}`,
          dockerfile: module.docker.file
        };

        dockerService.working_dir = '/bbox';

        dockerService.volumes = [`${moduleFolderPath}:/bbox`];
      }

      if (module.docker?.volumes) {
        dockerService.volumes = dockerService.volumes ?? [];
        for (const volumeName in module.docker.volumes) {
          const containerPath = module.docker.volumes[volumeName];
          dockerService.volumes.push(`${moduleFolderPath}/.bbox/state/volumes/${volumeName}:${containerPath}`);
        }
      }

      // if (module.env) {
      //   dockerService.environment = module.env;
      //   for (const envName of Object.keys(module.env)) {
      //     const envValue = module.env[envName];
      //     dockerService.environment[envName] = envValue;
      //   }
      // }

      dockerService.extra_hosts = extra_hosts;

      overwrite.services[module.name] = dockerService;
    }

    const yaml = YAML.stringify(overwrite, 4, 2);
    fs.writeFileSync(ctx.projectOpts.dockerComposePath, yaml);
  }

  @commandMethod()
  async run(params: RunCommandParams, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    if (modules.length === 0) {
      throw new Error('No modules found');
    }
    if (modules.length > 1) {
      throw new Error('More modules found');
    }
    const module = modules[0];

    try {
      await this.runInteractive(module, params.runnable, ctx);
    } catch (e) {
      console.error(e); // XXX
      throw e;
    }
  }

  @commandMethod()
  async shell(params: ShellParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);

    //TODO
  }

  @commandMethod()
  async build(params: ServiceCommandParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);

    await this.runBuild(module, ctx);
  }

  @commandMethod()
  async start(params: ServiceCommandParams, ctx: Ctx) {
    const {module, service} = await this.getService(params.services[0], ctx);

    await this.runStartDependenciesIfNeeded(module, service, ctx);

    await this.runStart(module, service, ctx);

    await this.setProxyForwardForServiceIfNeeded(module, service);
  }

  @commandMethod()
  async stop(params: ServiceCommandParams, ctx: Ctx) {
    const {service, module} = await this.getService(params.services[0], ctx);
    await this.processManager.stop(module, service, ctx);

    await this.unsetProxyForwardForServiceIfNeeded(module, service);
  }

  @commandMethod()
  async migrate(params: ServiceCommandParams, ctx: Ctx) {
    const module = await this.getModule(params.services[0], ctx);
    await this.runMigrate(module, ctx);
  }

  @commandMethod()
  async value(params: ServiceCommandParams, ctx: Ctx) {
    const ret = await this.provideValue(params.services[0], ctx);
    console.log(ret); // XXX
  }

  private async provideValue(valueName, ctx) {
    const [serviceName, providerName] = valueName.split('.');
    const {module, service} = await this.getService(serviceName, ctx);

    if (service.values && service.values[providerName]) {
      return service.values[providerName];
    }

    if (!service.valueProviders || !service.valueProviders[providerName]) {
      throw new Error(`Value provider ${providerName} not found`);
    }

    await this.runBuildIfNeeded(module, ctx);
    return await this.processManager.run(module, service.valueProviders[providerName], service.env, ctx);
  }

  @commandMethod()
  async list(params: ListCommandParams, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    for (const module of modules) {
      for (const service of Object.values(module.services)) {
        const process = await this.processManager.findServiceProcess(service, ctx);
        console.log(`${service.name} [${module.name}]: ${process?.status ?? 'Unknown'}, built: ${module.state.built}, pending migrations: ${this.getNotAppliedMigrations(module).join(', ')}, runtimes: ${module.availableRuntimes}`); // XXX
      }
    }
  }

  async shutdown() {
    await this.processManager.onShutdown();
  }

  private async runStart(module: Module, service: Service, ctx: Ctx) {
    if (service.provideEnvValues) {
      const envValues = await this.provideValues(service.provideEnvValues, ctx);
      Object.assign(service.env, envValues);
    }

    await this.runBuildIfNeeded(module, ctx);
    await this.runMigrationsIfNeeded(module, ctx);
    await this.processManager.startIfNeeded(module, service, ctx);
  }

  async runStartDependenciesIfNeeded(module: Module, service: Service, ctx: Ctx) {
    if (!service.dependencies) {
      return;
    }

    for (const serviceDependencyName of service.dependencies) {
      const {module, service} = await this.getService(serviceDependencyName, ctx);
      await this.runStartDependenciesIfNeeded(module, service, ctx);
      await this.runStart(module, service, ctx);
    }
  }

  private async provideValues(values: {[key: string]: string}, ctx) {
    const ret = {};
    for (const envName in values) {
      ret[envName] = await this.provideValue(values[envName], ctx);
    }
    return ret;
  }

  private async runBuild(module: Module, ctx: Ctx) {
    if (!module.build) {
      throw new Error('Module has not build action specified');
    }

    await this.runInteractive(module, module.build, ctx);

    module.state.built = true;
    this.fileManager.saveState(module);
  }

  private async runMigrate(module: Module, ctx: Ctx): Promise<{state?: Partial<ModuleState>}> {
    if (!module.migrations) {
      throw new Error('Module has not build action specified');
    }

    const diff = this.getNotAppliedMigrations(module);
    if (diff.length === 0) {
      console.log('> No new migrations'); // XXX
      return;
    }

    for (const migId of diff) {
      try {
        console.log(`> Migrating ${migId}`); // XXX
        await this.runInteractive(module, module.migrations[migId], ctx);

        module.state.ranMigrations.push(migId);
        this.fileManager.saveState(module);
      } catch (e) {
        console.log(`> Migration ${migId} failed.`); // XXX
        throw e;
      }
    }

    console.log(`> All new migrations applied.`); // XXX

    return {};
  }

  private async runInteractive(module: Module, runnable: Runnable, ctx: Ctx) {
    if (Array.isArray(runnable)) {
      for (const cmd of runnable) {
        await this.processManager.runInteractive(module, cmd, {}, ctx);
      }
      return;
    }

    await this.processManager.runInteractive(module, runnable, {}, ctx);
  }

  private async runBuildIfNeeded(module: Module, ctx: Ctx) {
    if (module.state.built || !module.build) {
      return;
    }

    await this.runBuild(module, ctx);
  }

  private async runMigrationsIfNeeded(module: Module, ctx: Ctx) {
    const migrations = this.getNotAppliedMigrations(module);
    if (migrations.length === 0) {
      return;
    }

    await this.runMigrate(module, ctx);
  }

  private getNotAppliedMigrations(module: Module) {
    if (!module.migrations) {
      return [];
    }

    const migrationIds = Object.keys(module.migrations).sort();
    const diff = difference(migrationIds, module.state.ranMigrations);
    return diff;
  }

  private async getModule(name: string, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    const module = modules.find((module) => module.name === name);
    if (!module) {
      throw new Error(`Module "${name}" not found. All discovered modules: ${modules.map(m => m.name).join(', ')}`);
    }
    return module;
  }

  private async getService(serviceName: string, ctx: Ctx) {
    const modules = await this.getAllModules(ctx);
    for (const module of modules) {
      const service = Object.values(module.services).find(app => app.name === serviceName);
      if (service) {
        return {
          module,
          service
        };
      }
    }

    throw new Error(`Service "${serviceName}" not found.`);
  }

  private async eachService(modules: Module[], callback: (service: Service) => Promise<void> | void) {
    for (const module of modules) {
      for (const service of Object.values(module.services)) {
        await callback(service);
      }
    }
  }

  private async getAllModules(ctx: Ctx) {
    const modules = await this.fileManager.discoverModules(ctx.projectOpts.rootPath);
    // Proxy module
    modules.push({
      name: 'proxy',
      absolutePath: __dirname,
      availableRuntimes: [Runtime.Local],
      runtime: Runtime.Local,
      state: {built: true, ranMigrations: []},
      migrations: {},
      services: {
        proxy: {
          name: 'proxy',
          subServices: {
            http: {
              name: 'http',
              port: 80
            },
            https: {
              name: 'https',
              port: 443
            }
          },
          start: 'node proxy-server.js',
          env: {
            configFilePath: ctx.projectOpts.proxyConfigPath
          }
        }
      }
    });

    return modules;
  }

  private setProxyForwardForServiceIfNeeded(module: Module, service: Service) {

  }

  private unsetProxyForwardForServiceIfNeeded(module: Module, service: Service) {
    console.log(module, service); // XXX
  }
}

