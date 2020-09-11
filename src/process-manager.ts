import {promisify} from "util";
import * as pm2 from 'pm2';
import * as fs from "fs";
import * as waitOn from 'wait-on';
import {spawnSync} from "child_process";
import {ProcessDescription} from 'pm2';
import {Ctx, EnvValues, Module, Runtime, Service} from './bbox';

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

      const runArgs = this.createDockerComposeRunArgs(module, false, ctx, cmdArgs);

      if (service.start) {
        runArgs.push(service.start);
      }
      const args = runArgs.join(' ');
      const cmd = `docker-compose ${args}`;
      console.log(cmd); // XXX
      await pm2Start({
        cwd: ctx.projectOpts.rootPath,
        name: service.name,
        script: 'docker-compose',
        args, // must be string, didn't work with array
        interpreter: 'none',// TODO needed?
        autorestart: false
      });
    } else {
      await pm2Start({
        name: service.name,
        cwd: module.absolutePath,
        script: service.start,
        interpreter: 'none',// TODO needed?
        env: service.env,
        autorestart: false
      });
    }

    if (service.healthCheck && service.healthCheck.waitOn) {
      console.log(`Waiting for the service health check: ${service.healthCheck.waitOn.resources.join(', ')}`); // XXX
      await waitOn(service.healthCheck.waitOn);
    }
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async runInteractive(module: Module, cmd: string, env: EnvValues, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      this.runInteractiveDocker(module, cmd, ctx);
      return;
    }

    this.runInteractiveLocal(module.absolutePath, cmd, env);
  }

  async run(module: Module, cmd: string, env: EnvValues, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      return this.runLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, false, ctx), {});
    }

    return this.runLocal(module.absolutePath, cmd, env);
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

  private runInteractiveLocal(cwd: string, cmd: string, env: EnvValues) {
    // env must be set from process.env otherwise docker-compose won't work
    env = {...process.env, ...env};

    const ret = spawnSync(cmd, {
      cwd,
      env,
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      throw new Error('spawn error');
    }
  }

  private runLocal(cwd: string, cmd: string, env: EnvValues) {
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
