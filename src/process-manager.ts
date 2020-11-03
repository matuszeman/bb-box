import {promisify} from 'util';
import * as pm2 from 'pm2';
import {ProcessDescription} from 'pm2';
import * as fs from 'fs';
import * as os from 'os';
import * as waitOn from 'wait-on';
import {spawn, spawnSync} from 'child_process';
import {Ctx, EnvValues, EnvValuesSpec, Module, Runtime, Service} from './bbox';

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

export class ProcessSpec {
  module: Module;
  name: string;
  env: EnvValues;
  cwd: string;

  ports: {}
}

export class ProcessManager {
  private pm2;

  async startAndWaitUntilStarted(service: Service, envValues: EnvValues, ctx: Ctx) {
    await this.start(service, envValues, ctx);
    await this.waitForStatus(service, ProcessStatus.Running, ctx);
  }

  private async waitForStatus(service, status: ProcessStatus, ctx: Ctx) {
    while(true) {
      const serviceProcess = await this.findServiceProcess(service, ctx);
      if (serviceProcess && serviceProcess.status === status) {
        break;
      }

      ctx.ui.print(`${service.name}: waiting to start the service`);
      await this.wait(1000);
    }
  }

  private async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start(service: Service, envValues: EnvValues, ctx: Ctx) {
    const module = service.module;
    const serviceSpec = service.spec;
    if (module.availableRuntimes.length === 0) {
      console.log(`No available runtime for service: ${serviceSpec.name}`);
      return;
    }

    await this.pm2Connect();

    const env = {
      BBOX_PATH: module.bboxPath,
      ...envValues
    };

    //TODO
    const pm2Options = service.spec.pm2Options ?? {};

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

      const runArgs = this.createDockerComposeRunArgs(module, false, ctx, env, cmdArgs);
      runArgs.push(service.name);

      if (serviceSpec.start) {
        runArgs.push(serviceSpec.start);
      }
      const args = runArgs.join(' ');
      const cmd = `docker-compose ${args}`;
      //console.log('Starting process: ', cmd); // XXX
      await pm2Start({
        cwd: ctx.projectOpts.rootPath,
        name: serviceSpec.name,
        script: 'docker-compose',
        args, // must be string, didn't work with array
        interpreter: 'none',// TODO needed?
        autorestart: false,
        killTimeout: 10000000, // TODO configurable
        ...pm2Options
      });
    } else {
      await pm2Start({
        name: serviceSpec.name,
        cwd: module.absolutePath,
        script: serviceSpec.start,
        interpreter: 'none',// TODO needed?
        env,
        autorestart: false,
        killTimeout: 10000000, // TODO configurable
        ...pm2Options
      });
    }

    if (serviceSpec.healthCheck && serviceSpec.healthCheck.waitOn) {
      ctx.ui.print(`Waiting for the service health check: ${serviceSpec.healthCheck.waitOn.resources.join(', ')}`);
      await waitOn(serviceSpec.healthCheck.waitOn);
    }
  }

  async onShutdown() {
    return this.pm2Disconnect()
  }

  async runInteractive(module: Module, cmd: string, env: EnvValues, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      return this.runInteractiveDocker(module, cmd, ctx, env);
    }

    return this.runInteractiveLocal(module.cwdAbsolutePath, cmd, env, ctx);
  }

  async run(module: Module, cmd: string, env: EnvValues, ctx: Ctx) {
    if (module.runtime === Runtime.Docker) {
      return this.runLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, false, ctx, env), {});
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

  async stopAndWaitUntilStopped(service: Service, ctx: Ctx) {
    await this.stop(service, ctx);
    await this.waitForStatus(service, ProcessStatus.NotRunning, ctx);
  }

  async getProcessList(ctx: Ctx): Promise<ProcessList> {
    await this.pm2Connect();
    const list = await pm2List();
    const processes: ProcessInstance[] = [];

    for (const proc of list) {
      processes.push(this.pm2ProcessToBboxProcess(proc));
    }

    const ret = {
      processes
    };

    return ret;
  }

  async findServiceProcess(service: Service, ctx: Ctx) {
    const {processes} = await this.getProcessList(ctx);
    return processes.find((process) => process.serviceName === service.name);
  }

  private async runInteractiveDocker(module: Module, cmd: string, ctx: Ctx, env: EnvValues) {
    return this.runInteractiveLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, true, ctx, env), {}, ctx);
  }

  private createDockerComposeRunCmd(module: Module, cmd: string | undefined, interactive: boolean, ctx: Ctx, env: EnvValues) {
    const args = this.createDockerComposeRunArgs(module, interactive, ctx, env);
    args.push(module.name, cmd);
    return `docker-compose ${args.join(' ')}`;
  }

  private createDockerComposeRunArgs(module: Module, interactive: boolean, ctx: Ctx, env: EnvValues, cmdArgs: string[] = []) {
    const args = [
      `--project-directory ${this.escapeShellValue(ctx.projectOpts.rootPath)}`,
      `-f ${this.escapeShellValue(ctx.projectOpts.dockerComposePath)}`
    ];

    const overridePath = `${ctx.projectOpts.rootPath}/docker-compose.override.yml`;
    if (fs.existsSync(overridePath)) {
      args.push(`-f ${this.escapeShellValue(overridePath)}`);
    }

    args.push('run', '--rm', '--use-aliases');
    if (!interactive) {
      args.push('-T');
    }

    // Use user option only for local modules
    if (module.availableRuntimes.findIndex(value => value === Runtime.Local) !== -1
      && os.type() === 'Linux' && process.getgid && process.getuid) {
      const user = `${process.getuid()}:${process.getgid()}`;
      args.push(`--user=${this.escapeShellValue(user)}`)
    }

    for (const envName in env) {
      args.push(`-e ${envName}=${this.escapeShellValue(env[envName])}`);
    }

    args.push(...cmdArgs);

    return args;
  }

  private async runInteractiveLocal(cwd: string, cmd: string, envValues: EnvValues, ctx: Ctx): Promise<{output: string}> {
    //console.log('runInteractiveLocal: ', cmd); // XXX
    // env must be set from process.env otherwise docker-compose won't work
    const env = {...process.env, ...this.escapeEnvValues(envValues)};

    //console.log('runInteractiveLocal', cmd); // XXX

    const output = [];
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, {
        cwd,
        env,
        shell: true, //throws error without this
        stdio: [ctx.ui.stdin, 'pipe', process.stderr]
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data) => {
        output.push(data);
        ctx.ui.stdout.write(data);
      });
      child.on('exit', (code, signal) => {
        const err: any = this.handleSpawnReturn(code, signal);
        if (err) {
          err.output = output.join('');
          return reject(err);
        }
        resolve({
          output: output.join('')
        });
      });
    })
  }

  private runLocal(cwd: string, cmd: string, env: EnvValues) {
    //console.log('runLocal: ', cmd); // XXX
    // env must be set from process.env otherwise docker-compose won't work
    env = {...process.env, ...this.escapeEnvValues(env)};

    const ret = spawnSync(cmd, {
      cwd,
      env,
      shell: true, //throws error without this
      windowsHide: true
    });
    const err = this.handleSpawnReturn(ret.status, ret.signal);
    if (err) {
      throw err;
    }
    return ret.stdout.toString();
  }

  private handleSpawnReturn(status, signal) {
    if (signal === 'SIGINT') {
      return new Error('User interrupted');
    }
    if (status !== null && status !== 0) {
      return new Error(`Spawned process returned error code: ${status}`);
    }
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

  /**
   * Do not escape comma, dot and : separated values
   * E.g: SERVICES='sqs,sns,lambda,cloudwatch,s3,s3api,dynamodb' - This was causing sqs and dynamodb to be ignored by localstack
   * E.g: HOSTNAME_EXTERNAL='localstack.local.slido-staging.com' - hostname was set with single quote also
   * E.g: --user='1000:1000' - "Error response from daemon: unable to find user "1000: no matching entries in passwd file"
   */
  private escapeShellValue(s: string) {
    if (!/^[A-Za-z0-9_\/:,\.-]+$/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''")+"'";
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    return s;
  }

  private escapeEnvValues(env: EnvValues) {
    const ret: EnvValues = {};
    for (const envName in env) {
      ret[envName] = this.escapeShellValue(env[envName]);
    }
    return ret;
  }
}
