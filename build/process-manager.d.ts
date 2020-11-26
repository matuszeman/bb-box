import { Ctx, EnvValues, Module, Service } from './bbox';
export declare enum ProcessStatus {
    Unknown = "Unknown",
    Starting = "Starting",
    Running = "Running",
    Stopping = "Stopping",
    NotRunning = "NotRunning"
}
export declare class ProcessInstance {
    serviceName: string;
    status: ProcessStatus;
}
export declare class ProcessList {
    processes: ProcessInstance[];
}
export declare class ProcessSpec {
    module: Module;
    name: string;
    env: EnvValues;
    cwd: string;
    ports: {};
}
export declare class ProcessManager {
    private pm2;
    startAndWaitUntilStarted(service: Service, envValues: EnvValues, ctx: Ctx): Promise<void>;
    private waitForStatus;
    private wait;
    start(service: Service, envValues: EnvValues, ctx: Ctx): Promise<void>;
    onShutdown(): Promise<void>;
    runInteractive(module: Module, cmd: string, env: EnvValues, ctx: Ctx): Promise<{
        output: string;
    }>;
    run(module: Module, cmd: string, env: EnvValues, ctx: Ctx): Promise<string>;
    stop(service: Service, ctx: Ctx): Promise<void>;
    stopAndWaitUntilStopped(service: Service, ctx: Ctx): Promise<void>;
    getProcessList(ctx: Ctx): Promise<ProcessList>;
    findServiceProcess(service: Service, ctx: Ctx): Promise<ProcessInstance>;
    private runInteractiveDocker;
    private createDockerComposeRunCmd;
    private createDockerComposeRunArgs;
    private runInteractiveLocal;
    private runLocal;
    private handleSpawnReturn;
    private pm2ProcessToBboxProcess;
    private pm2Connect;
    private pm2Disconnect;
    /**
     * Do not escape comma, dot and : separated values
     * E.g: SERVICES='sqs,sns,lambda,cloudwatch,s3,s3api,dynamodb' - This was causing sqs and dynamodb to be ignored by localstack
     * E.g: HOSTNAME_EXTERNAL='localstack.local.slido-staging.com' - hostname was set with single quote also
     * E.g: --user='1000:1000' - "Error response from daemon: unable to find user "1000: no matching entries in passwd file"
     */
    private escapeShellValue;
    private escapeEnvValues;
}
