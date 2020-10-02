import {promisify} from "util";
import * as pm2 from 'pm2';
import * as fs from "fs";
import * as waitOn from 'wait-on';
import {spawnSync, SpawnSyncReturns} from 'child_process';
import {ProcessDescription} from 'pm2';
import {Ctx, EnvValuesSpec, Module, Runtime, Service, ServiceSpec} from './bbox';

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

export class ProcessInstance {
  serviceName: string;
  status: ProcessStatus;
}

export class ProcessList {
  processes: ProcessInstance[];
}

export class ProcessManager {
  private pm2;

  async startIfNeeded(service: Service, ctx: Ctx) {
    const process = await this.findServiceProcess(service, ctx);
    if (process && process.status === ProcessStatus.Running) {
      return;
    }
    await this.start(service, ctx);
  }

  async startAndWait(service: Service, ctx: Ctx) {
    await this.start(service, ctx);
    await this.waitForStatus(service, ProcessStatus.Running, ctx);
  }

  private async waitForStatus(service, status: ProcessStatus, ctx: Ctx) {
    while(true) {
      const serviceProcess = await this.findServiceProcess(service, ctx);
      if (serviceProcess.status === status) {
        break;
      }

      console.log('Waiting for running process...'); // XXX
      await this.wait(1000);
    }
  }

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start(service: Service, ctx: Ctx) {
    const module = service.module;
    const serviceSpec = service.spec;
    if (module.availableRuntimes.length === 0) {
      console.log(`No available runtime for service: ${serviceSpec.name}`);
      return;
    }

    await this.pm2Connect();

    const env = {
      BBOX_PATH: module.bboxPath,
      ...serviceSpec.env
    };

    if (module.runtime === Runtime.Docker) {
      const cmdArgs = [];
      if (serviceSpec.port) {
        cmdArgs.push(`-p ${serviceSpec.port}:${serviceSpec.containerPort ?? serviceSpec.port}`);
      }

      if (serviceSpec.subServices) {
        for (const subServiceKey of Object.keys(serviceSpec.subServices)) {
          const subService = serviceSpec.subServices[subServiceKey];
          cmdArgs.push(`-p ${subService.port}:${subService.containerPort ?? subService.port}`);
        }
      }

      const runArgs = this.createDockerComposeRunArgs(module, false, ctx, cmdArgs);

      if (serviceSpec.start) {
        runArgs.push(serviceSpec.start);
      }
      const args = runArgs.join(' ');
      const cmd = `docker-compose ${args}`;
      console.log(cmd); // XXX
      await pm2Start({
        cwd: ctx.projectOpts.rootPath,
        name: serviceSpec.name,
        script: 'docker-compose',
        args, // must be string, didn't work with array
        interpreter: 'none',// TODO needed?
        autorestart: false
      });
    } else {
      await pm2Start({
        name: serviceSpec.name,
        cwd: module.absolutePath,
        script: serviceSpec.start,
        interpreter: 'none',// TODO needed?
        env,
        autorestart: false
      });
    }

    if (serviceSpec.healthCheck && serviceSpec.healthCheck.waitOn) {
      console.log(`Waiting for the service health check: ${serviceSpec.healthCheck.waitOn.resources.join(', ')}`); // XXX
      await waitOn(serviceSpec.healthCheck.waitOn);
    }
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async runInteractive(module: Module, cmd: string, env: EnvValuesSpec, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      this.runInteractiveDocker(module, cmd, ctx);
      return;
    }

    this.runInteractiveLocal(module.cwdAbsolutePath, cmd, env);
  }

  async run(module: Module, cmd: string, env: EnvValuesSpec, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      return this.runLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, false, ctx), {});
    }

    return this.runLocal(module.cwdAbsolutePath, cmd, env);
  }

  async stop(service: Service, ctx: Ctx) {
    await this.pm2Connect();
    try {
      await pm2Stop(service.name);
    } catch (e) {
      throw new Error(`PM2 error: ${e.message}`);
    }
  }

  async stopAndWait(service: Service, ctx: Ctx) {
    await this.stop(service, ctx);
    await this.waitForStatus(service, ProcessStatus.NotRunning, ctx);
  }

  async getProcessList(ctx: Ctx): Promise<ProcessList> {
    if (ctx.processList) {
      return ctx.processList;
    }

    await this.pm2Connect();
    const list = await pm2List();
    const processes: ProcessInstance[] = [];

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

  private runInteractiveDocker(module: Module, cmd: string, ctx: Ctx) {
    this.runInteractiveLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, true, ctx), {});
  }

  private createDockerComposeRunCmd(module: Module, cmd: string | undefined, interactive: boolean, ctx: Ctx) {
    const args = this.createDockerComposeRunArgs(module, interactive, ctx);
    args.push(cmd);
    return `docker-compose ${args.join(' ')}`;
  }

  private createDockerComposeRunArgs(module: Module, interactive: boolean, ctx: Ctx, cmdArgs: string[] = []) {
    const args = [
      `--project-directory ${ctx.projectOpts.rootPath}`,
      `-f ${ctx.projectOpts.dockerComposePath}`
    ];

    const overridePath = `${ctx.projectOpts.rootPath}/docker-compose.override.yml`;
    if (fs.existsSync(overridePath)) {
      args.push(`-f ${overridePath}`);
    }

    args.push('run', '--rm', '--use-aliases');
    if (!interactive) {
      args.push('-T');
    }

    args.push(...cmdArgs);

    args.push(module.name);
    return args;
  }

  private runInteractiveLocal(cwd: string, cmd: string, env: EnvValuesSpec) {
    // env must be set from process.env otherwise docker-compose won't work
    env = {...process.env, ...env};

    const ret = spawnSync(cmd, {
      cwd,
      env,
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== null && ret.status !== 0) {
      console.log(ret); // XXX
      throw new Error(`${ret.status}: ${ret.stderr}`);
    }

    return ret;
  }

  private runLocal(cwd: string, cmd: string, env: EnvValuesSpec) {
    // env must be set from process.env otherwise docker-compose won't work
    env = {...process.env, ...env};

    const ret = spawnSync(cmd, {
      cwd,
      env,
      shell: true, //throws error without this
      windowsHide: true
    });
    if (ret.status !== 0) {
      const err = ret.stderr.toString();
      throw new Error(`spawn error: ${err}`);
    }
    return ret.stdout.toString();
  }

  private pm2ProcessToBboxProcess(proc: ProcessDescription): ProcessInstance {
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
