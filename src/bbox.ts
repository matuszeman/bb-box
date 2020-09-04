import 'source-map-support/register';
import 'reflect-metadata';

import * as globby from 'globby';
import * as shell from 'shelljs';
import * as process from 'process';
import { difference } from 'lodash';
import * as nodePath from 'path';
import * as fs from 'fs';
import * as pm2 from 'pm2';
import {promisify} from 'util';
import * as jf from 'joiful';
import {PrettyJoi} from './pretty-joi';
import * as dockerCompose from 'docker-compose';
import {parse} from 'yamljs';
import {spawnSync} from 'child_process'
import {ls} from 'shelljs';
//import {ProxyConfig} from './proxy-server';
import * as YAML from 'yamljs'
import {ProxyConfig} from './proxy-server';
import {ProcessDescription} from 'pm2';
import * as waitOn from 'wait-on';
import {WaitOnOptions} from 'wait-on';

export interface RunnableFnOpts {
  module: Module;
}

//type RunnableFn = (RunnableFnOpts) => Promise<any>;
//type Runnable = string | string[] | RunnableFn | RunnableFn[];
type Runnable = string | string[];
type Dependency = string;

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
  env?: {[key: string]: any},
  dependencies?: Dependency[],
  healthCheck?: {
    // https://www.npmjs.com/package/wait-on#nodejs-api-usage
    waitOn: WaitOnOptions
  }
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
  dockerImage?: string;
  dockerFile?: string;
  services: {[key: string]: Service};
  build?: Runnable;
  migrations?: {[key: string]: Runnable};
  env?: {[key: string]: any},
  volumes?: {
    [key: string]: {
      containerPath: string
    }
  }
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
    private runner: Runner,
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

      if (module.dockerImage) {
        dockerService.image = module.dockerImage;
      }

      if (module.dockerFile) {
        // TODO use project name instead of "bbox"
        dockerService.image = `bbox-${module.name}`;
        dockerService.build = {
          context: `./${moduleFolderName}`,
          dockerfile: module.dockerFile
        };

        dockerService.working_dir = '/bbox';

        dockerService.volumes = [`${moduleFolderPath}:/bbox`];
      }

      if (module.volumes) {
        dockerService.volumes = dockerService.volumes ?? [];
        for (const volumeName of Object.keys(module.volumes)) {
          const volumeSpec = module.volumes[volumeName];
          dockerService.volumes.push(`${moduleFolderPath}/.bbox/state/volumes/${volumeName}:${volumeSpec.containerPath}`);
        }
      }

      if (module.env) {
        dockerService.environment = module.env;
        for (const envName of Object.keys(module.env)) {
          const envValue = module.env[envName];
          dockerService.environment[envName] = envValue;
        }
      }

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
      await this.runner.run(module, params.runnable, ctx);
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

  private async runBuild(module: Module, ctx: Ctx) {
    if (!module.build) {
      throw new Error('Module has not build action specified');
    }

    await this.runner.run(module, module.build, ctx);

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
        await this.runner.run(module, module.migrations[migId], ctx);

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

        if (module.dockerImage || module.dockerFile) {
          module.availableRuntimes.push(Runtime.Docker);
        }

        // Services
        if (module.services) {
          for (const serviceName of Object.keys(module.services)) {
            const service = module.services[serviceName];
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

    // @DockerCompose
    // try {
    //   const dockerComposeServices = await dockerCompose.config({cwd: path});
    //   const dockerComposeFile = parse(dockerComposeServices.out);
    //   const services = Object.keys(dockerComposeFile.services);
    //   for (const serviceName of services) {
    //     const foundAppModule = modules.find((module) => module.name === serviceName);
    //     if (!foundAppModule) {
    //       throw new Error(`Module not found: ${serviceName}`)
    //     }
    //     foundAppModule.availableRuntimes.push(Runtime.DockerCompose);
    //   }
    // } catch (e) {
    //   if (e.err && e.err.includes('Can\'t find a suitable configuration file')) {
    //     console.log('No docker-compose configuration found'); // XXX
    //   } else {
    //     console.log('DockerComposer error', e); // XXX
    //   }
    // }

    //console.log(JSON.stringify(modules, null, 2)); // XXX

    for (const module of modules) {
      if (module.availableRuntimes.length === 0) {
        //throw new Error(`Module ${module.name} has no available runtime`);
      }
      if (!module.runtime) {
        module.runtime = module.availableRuntimes[0];
      }
    }


    //const pluginServices = await this.runPlugins('discoverServices');

    //TODO do some magic to merge/select values from discovered plugin services
    //defaultsDeep(services, pluginServices);

    return modules;
  }

  saveState(module: Module) {
    fs.writeFileSync(`${module.absolutePath}/.bbox/state.json`, JSON.stringify(module.state, null, 2));
  }
}

export class Runner {
  async run(module: Module, runnable: Runnable, ctx: Ctx) {
    if (Array.isArray(runnable)) {
      for (const one of runnable) {
        await this.run(module, one, ctx);
      }
      return;
    }

    // Do we want to support inline functions?
    // if (typeof runnable === 'function') {
    //   await runnable({
    //     module,
    //     ctx
    //   });
    //   return;
    // }

    if (typeof runnable === 'string') {
      if (module.runtime === Runtime.Docker) {
        await this.runDocker(module, runnable, ctx);
        return;
      }

      this.runShellCmd(module.absolutePath, runnable);
      return;
    }

    throw new Error('Can not run ' + typeof runnable);
  }

  private async runDocker(module: Module, cmd: string, ctx: Ctx) {
    const args = [];

    // linux
    // const hostIp = '172.17.0.1';
    // args.push(`--add-host=xxx:${hostIp}`);

    this.spawn('docker-compose', ['run', '--rm', '--use-aliases', ...args, module.name, cmd], {});
  }

  private runShellCmd(cwd: string, cmd: string) {
    this.shell.pushd(cwd);
    const opts = this.createExecOpts();
    opts.silent = false;
    console.log(`> Running: ${cmd}`); // XXX
    const ret = this.shell.exec(cmd, opts);
    if (ret.code !== 0) {
      throw new Error(`shell error: ${ret.stderr}`);
    }
    this.shell.popd();
  }

  private spawn(cmd, args, opts) {
    //merge current process env with spawn cmd
    //const env = _.defaults({}, opts.env, process.env);
    const env = process.env;
    // const userGroup = this.getUserGroup();
    // if (userGroup) {
    //   env.BOX_USER = userGroup;
    // }
    const cmdString = `${cmd} ${args.join(' ')}`;
    console.log(cmdString); // XXX
    const ret = spawnSync(cmd, args, {
      env,
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      console.error(ret); //XXX
      throw new Error('spawn error');
    }
  }

  private createExecOpts() {
    const env = process.env;
    const opts = {
      //async: true //TODO
      silent: false,
      windowsHide: true, //do not open terminal window on Windows
      env
    };

    return opts;
  }

  get shell() {
    shell.config.reset();
    shell.config.silent = true;
    return shell;
  }
}

const pm2Connect = promisify(pm2.connect).bind(pm2);
const pm2Disconnect = promisify(pm2.disconnect).bind(pm2);
const pm2Start = promisify(pm2.start).bind(pm2);
const pm2Restart = promisify(pm2.restart).bind(pm2);
const pm2Stop = promisify(pm2.stop).bind(pm2);
const pm2List = promisify(pm2.list).bind(pm2);
const pm2SendDataToProcessId = promisify(pm2.sendDataToProcessId).bind(pm2);

export enum ProcessStatus {
  Unknown = 'Unknown',
  Starting = 'Starting',
  Running = 'Running',
  Stopping = 'Stopping',
  NotRunning = 'NotRunning'
}

export class Process {
  serviceName: string;
  status: ProcessStatus;
}

export class ProcessList {
  processes: Process[];
}

export class ProcessManager {
  private pm2;

  async startIfNeeded(module: Module, service: Service, ctx: Ctx) {
    const process = await this.findServiceProcess(service, ctx);
    if (process && process.status === ProcessStatus.Running) {
      return;
    }
    await this.start(module, service, ctx);
  }

  async start(module: Module, service: Service, ctx: Ctx) {
    if (module.availableRuntimes.length === 0) {
      console.log(`No available runtime for service: ${service.name}`);
      return;
    }

    await this.pm2Connect();
    if (module.runtime === Runtime.Docker) {
      const cmdArgs = [];

      if (service.port) {
        cmdArgs.push(`-p ${service.port}:${service.containerPort ?? service.port}`);
      }

      if (service.subServices) {
        for (const subServiceKey of Object.keys(service.subServices)) {
          const subService = service.subServices[subServiceKey];
          cmdArgs.push(`-p ${subService.port}:${subService.containerPort ?? subService.port}`);
        }
      }

      let dockerComposeArgs = `--project-directory ${ctx.projectOpts.rootPath}`;

      dockerComposeArgs += ` -f ${ctx.projectOpts.dockerComposePath}`;
      if (ctx.projectOpts.dockerComposePath) {
        dockerComposeArgs += ` -f ${ctx.projectOpts.dockerComposePath}`;
      }
      const overridePath = `${ctx.projectOpts.rootPath}/docker-compose.override.yml`;
      if (fs.existsSync(overridePath)) {
        dockerComposeArgs += ` -f ${overridePath}`;
      }

      const runCmd = `${dockerComposeArgs} run --rm ${cmdArgs.join(' ')} ${module.name}`;
      console.log(`docker-compose ${runCmd}`); // XXX
      if (service.start) {
        await pm2Start({
          name: service.name,
          script: 'docker-compose',
          args: `${runCmd} ${service.start}`,
          autorestart: false
        });
      } else {
        await pm2Start({
          name: service.name,
          script: 'docker-compose',
          args: runCmd,
          autorestart: false
        });
      }
    } else {
      await pm2Start({
        name: service.name,
        cwd: module.absolutePath,
        script: service.start,
        env: service.env,
        autorestart: false
      });
    }

    if (service.healthCheck && service.healthCheck.waitOn) {
      console.log(`Waiting for the service health check: ${service.healthCheck.waitOn.resources.join(', ')}`); // XXX
      await waitOn(service.healthCheck.waitOn);
    }
  }

  async sendDataToService(module: Module, service: Service) {
    await this.pm2Connect();
    const processList = await pm2List();

    const ret = await pm2SendDataToProcessId(0, {
      id: 0,
      type : 'message',
      data : {
        some : 'data',
        hello : true
      },
      topic: 'some topic'
    });
    console.log(ret); // XXX
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async stop(module: Module, service: Service, ctx: Ctx) {
    await this.pm2Connect();
    try {
      await pm2Stop(service.name);
    } catch (e) {
      throw new Error(`PM2 error: ${e.message}`);
    }
  }

  async getProcessList(ctx: Ctx): Promise<ProcessList> {
    if (ctx.processList) {
      return ctx.processList;
    }

    await this.pm2Connect();
    const list = await pm2List();
    const processes: Process[] = [];

    for (const proc of list) {
      processes.push(this.pm2ProcessToBboxProcess(proc));
    }

    const ret = {
      processes
    };

    ctx.processList = ret;
    return ret;
  }

  async findServiceProcess(service: Service, ctx: Ctx) {
    const {processes} = await this.getProcessList(ctx);
    return processes.find((process) => process.serviceName === service.name);
  }

  private pm2ProcessToBboxProcess(proc: ProcessDescription): Process {
    const statusMap = {
      online: ProcessStatus.Running,
      stopping: ProcessStatus.Stopping,
      stopped: ProcessStatus.NotRunning,
      launching: ProcessStatus.Starting,
      errored: ProcessStatus.NotRunning,
      'one-launch-status': ProcessStatus.Unknown
    }
    return {
      serviceName: proc.name,
      status: statusMap[proc.pm2_env.status]
    };
  }

  private async pm2Connect() {
    if (!this.pm2) {
      await pm2Connect();
      this.pm2 = pm2;
    }

    return this.pm2;
  }

  private async pm2Disconnect() {
    if (this.pm2) {
      await pm2Disconnect();
      this.pm2 = null;
    }
  }
}
