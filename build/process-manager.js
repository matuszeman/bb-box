"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManager = exports.ProcessSpec = exports.ProcessList = exports.ProcessInstance = exports.ProcessStatus = void 0;
const util_1 = require("util");
const pm2 = require("pm2");
const fs = require("fs");
const os = require("os");
const waitOn = require("wait-on");
const child_process_1 = require("child_process");
const bbox_1 = require("./bbox");
const pm2Connect = util_1.promisify(pm2.connect).bind(pm2);
const pm2Disconnect = util_1.promisify(pm2.disconnect).bind(pm2);
const pm2Start = util_1.promisify(pm2.start).bind(pm2);
const pm2Restart = util_1.promisify(pm2.restart).bind(pm2);
const pm2Stop = util_1.promisify(pm2.stop).bind(pm2);
const pm2List = util_1.promisify(pm2.list).bind(pm2);
const pm2SendDataToProcessId = util_1.promisify(pm2.sendDataToProcessId).bind(pm2);
var ProcessStatus;
(function (ProcessStatus) {
    ProcessStatus["Unknown"] = "Unknown";
    ProcessStatus["Starting"] = "Starting";
    ProcessStatus["Running"] = "Running";
    ProcessStatus["Stopping"] = "Stopping";
    ProcessStatus["NotRunning"] = "NotRunning";
})(ProcessStatus = exports.ProcessStatus || (exports.ProcessStatus = {}));
class ProcessInstance {
}
exports.ProcessInstance = ProcessInstance;
class ProcessList {
}
exports.ProcessList = ProcessList;
class ProcessSpec {
}
exports.ProcessSpec = ProcessSpec;
class ProcessManager {
    async startAndWaitUntilStarted(service, envValues, ctx) {
        await this.start(service, envValues, ctx);
        await this.waitForStatus(service, ProcessStatus.Running, ctx);
    }
    async waitForStatus(service, status, ctx) {
        while (true) {
            const serviceProcess = await this.findServiceProcess(service, ctx);
            if (serviceProcess && serviceProcess.status === status) {
                break;
            }
            ctx.ui.print(`${service.name}: waiting to start the service`);
            await this.wait(1000);
        }
    }
    async wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    createEnv(module, envValues) {
        let userEnv;
        if (os.type() === 'Linux' && process.getgid && process.getuid) {
            userEnv = {
                USER_ID: process.getuid(),
                GROUP_ID: process.getgid()
            };
        }
        return Object.assign(Object.assign({ BBOX_PATH: module.bboxPath }, envValues), userEnv);
    }
    async start(service, envValues, ctx) {
        var _a, _b, _c;
        const module = service.module;
        const serviceSpec = service.spec;
        if (module.availableRuntimes.length === 0) {
            console.log(`No available runtime for service: ${serviceSpec.name}`);
            return;
        }
        await this.pm2Connect();
        const env = this.createEnv(service.module, envValues);
        //TODO
        const pm2Options = (_a = service.spec.pm2Options) !== null && _a !== void 0 ? _a : {};
        if (module.runtime === bbox_1.Runtime.Docker) {
            const cmdArgs = [];
            if (serviceSpec.port) {
                cmdArgs.push(`-p ${serviceSpec.port}:${(_b = serviceSpec.containerPort) !== null && _b !== void 0 ? _b : serviceSpec.port}`);
            }
            if (serviceSpec.subServices) {
                for (const subServiceKey of Object.keys(serviceSpec.subServices)) {
                    const subService = serviceSpec.subServices[subServiceKey];
                    cmdArgs.push(`-p ${subService.port}:${(_c = subService.containerPort) !== null && _c !== void 0 ? _c : subService.port}`);
                }
            }
            const runArgs = this.createDockerComposeRunArgs(module, false, ctx, env, cmdArgs);
            runArgs.push(service.name);
            if (serviceSpec.start) {
                runArgs.push(serviceSpec.start);
            }
            const args = runArgs.join(' ');
            const cmd = `docker-compose ${args}`;
            console.log('Starting process: ', cmd); // XXX
            await pm2Start(Object.assign({ cwd: ctx.projectOpts.rootPath, name: serviceSpec.name, script: 'docker-compose', args,
                env, interpreter: 'none', autorestart: false, killTimeout: 10000000 }, pm2Options));
        }
        else {
            await pm2Start(Object.assign({ name: serviceSpec.name, cwd: module.absolutePath, script: serviceSpec.start, interpreter: 'none', // TODO needed?
                env, autorestart: false, killTimeout: 10000000 }, pm2Options));
        }
        if (serviceSpec.healthCheck && serviceSpec.healthCheck.waitOn) {
            ctx.ui.print(`Waiting for the service health check: ${serviceSpec.healthCheck.waitOn.resources.join(', ')}`);
            await waitOn(Object.assign({ interval: 1000 }, serviceSpec.healthCheck.waitOn));
        }
    }
    async onShutdown() {
        return this.pm2Disconnect();
    }
    async runInteractive(module, cmd, env, ctx) {
        if (module.runtime === bbox_1.Runtime.Docker) {
            return this.runInteractiveDocker(module, cmd, ctx, env);
        }
        return this.runInteractiveLocal(module.cwdAbsolutePath, cmd, env, ctx);
    }
    async run(module, cmd, env, ctx) {
        if (module.runtime === bbox_1.Runtime.Docker) {
            return this.runLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, false, ctx, env), {});
        }
        return this.runLocal(module.cwdAbsolutePath, cmd, env);
    }
    async stop(service, ctx) {
        await this.pm2Connect();
        try {
            await pm2Stop(service.name);
        }
        catch (e) {
            throw new Error(`PM2 error: ${e.message}`);
        }
    }
    async stopAndWaitUntilStopped(service, ctx) {
        await this.stop(service, ctx);
        await this.waitForStatus(service, ProcessStatus.NotRunning, ctx);
    }
    async getProcessList(ctx) {
        await this.pm2Connect();
        const list = await pm2List();
        const processes = [];
        for (const proc of list) {
            processes.push(this.pm2ProcessToBboxProcess(proc));
        }
        const ret = {
            processes
        };
        return ret;
    }
    async findServiceProcess(service, ctx) {
        const { processes } = await this.getProcessList(ctx);
        return processes.find((process) => process.serviceName === service.name);
    }
    async runInteractiveDocker(module, cmd, ctx, env) {
        return this.runInteractiveLocal(ctx.projectOpts.rootPath, this.createDockerComposeRunCmd(module, cmd, true, ctx, env), this.createEnv(module, env), ctx);
    }
    createDockerComposeRunCmd(module, cmd, interactive, ctx, env) {
        const args = this.createDockerComposeRunArgs(module, interactive, ctx, env);
        args.push(module.name, cmd);
        return `docker-compose ${args.join(' ')}`;
    }
    createDockerComposeRunArgs(module, interactive, ctx, env, cmdArgs = []) {
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
            //args.push('-T');
        }
        // Use user option only for local modules
        if (module.availableRuntimes.findIndex(value => value === bbox_1.Runtime.Local) !== -1
            && os.type() === 'Linux' && process.getgid && process.getuid) {
            const user = `${process.getuid()}:${process.getgid()}`;
            args.push(`--user=${this.escapeShellValue(user)}`);
        }
        for (const envName in env) {
            args.push(`-e ${envName}=${this.escapeShellValue(env[envName])}`);
        }
        args.push(...cmdArgs);
        return args;
    }
    async runInteractiveLocal(cwd, cmd, envValues, ctx) {
        //console.log('runInteractiveLocal: ', cmd); // XXX
        // env must be set from process.env otherwise docker-compose won't work
        const env = Object.assign(Object.assign({}, process.env), this.escapeEnvValues(envValues));
        //console.log('runInteractiveLocal', cmd); // XXX
        const output = [];
        return new Promise((resolve, reject) => {
            const child = child_process_1.spawn(cmd, {
                cwd,
                env,
                shell: true,
                stdio: [ctx.ui.stdin, 'pipe', process.stderr]
            });
            child.stdout.setEncoding('utf8');
            child.stdout.on('data', (data) => {
                output.push(data);
                ctx.ui.stdout.write(data);
            });
            child.on('exit', (code, signal) => {
                const err = this.handleSpawnReturn(code, signal);
                if (err) {
                    err.output = output.join('');
                    return reject(err);
                }
                resolve({
                    output: output.join('')
                });
            });
        });
    }
    runLocal(cwd, cmd, env) {
        //console.log('runLocal: ', cmd); // XXX
        // env must be set from process.env otherwise docker-compose won't work
        env = Object.assign(Object.assign({}, process.env), this.escapeEnvValues(env));
        const ret = child_process_1.spawnSync(cmd, {
            cwd,
            env,
            shell: true,
            windowsHide: true
        });
        const err = this.handleSpawnReturn(ret.status, ret.signal);
        if (err) {
            throw err;
        }
        return ret.stdout.toString();
    }
    handleSpawnReturn(status, signal) {
        if (signal === 'SIGINT') {
            return new Error('User interrupted');
        }
        if (status !== null && status !== 0) {
            return new Error(`Spawned process returned error code: ${status}, signal: ${signal}`);
        }
    }
    pm2ProcessToBboxProcess(proc) {
        const statusMap = {
            online: ProcessStatus.Running,
            stopping: ProcessStatus.Stopping,
            stopped: ProcessStatus.NotRunning,
            launching: ProcessStatus.Starting,
            errored: ProcessStatus.NotRunning,
            'one-launch-status': ProcessStatus.Unknown
        };
        return {
            serviceName: proc.name,
            status: statusMap[proc.pm2_env.status]
        };
    }
    async pm2Connect() {
        if (!this.pm2) {
            await pm2Connect();
            this.pm2 = pm2;
        }
        return this.pm2;
    }
    async pm2Disconnect() {
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
    escapeShellValue(s) {
        if (!/^[A-Za-z0-9_\/:,\.-]+$/.test(s)) {
            s = "'" + s.replace(/'/g, "'\\''") + "'";
            s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
                .replace(/\\'''/g, "\\'"); // remove non-escaped single-quote if there are enclosed between 2 escaped
        }
        return s;
    }
    escapeEnvValues(env) {
        const ret = {};
        for (const envName in env) {
            ret[envName] = this.escapeShellValue(env[envName]);
        }
        return ret;
    }
}
exports.ProcessManager = ProcessManager;
//# sourceMappingURL=process-manager.js.map