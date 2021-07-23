"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cli = void 0;
const commander_1 = require("commander");
function createServiceCommand(program, cmd) {
    return program.command(`${cmd} <service>`)
        .option('--deps', 'TODO run with dependencies');
}
function runCommandOpts(bbox, ctx, handler) {
    return async (command) => {
        try {
            await handler.bind(bbox)(command.opts(), ctx);
            //await bbox.status({}, ctx);
        }
        catch (e) {
            console.error(e); //XXX
        }
    };
}
function runServiceCommand(bbox, ctx, handler) {
    return async (service, command) => {
        try {
            const commandParams = Object.assign({ service }, command.opts());
            await handler.bind(bbox)(commandParams, ctx);
            //await bbox.status({}, ctx);
        }
        catch (e) {
            console.error(e); //XXX
        }
    };
}
function runCommand(bbox, ctx, handler, paramsHandler) {
    return async function () {
        try {
            const params = paramsHandler(...arguments);
            await handler.bind(bbox)(params, ctx);
            //await bbox.status({}, ctx);
        }
        catch (e) {
            console.error(e); //XXX
        }
    };
}
class Cli {
    constructor(bbox, ctx) {
        this.bbox = bbox;
        this.ctx = ctx;
        const program = new commander_1.Command();
        //program.exitOverride();
        program.passCommandToAction(true);
        program.allowUnknownOption(false);
        program.storeOptionsAsProperties(false);
        program.version(require('../package.json').version);
        createServiceCommand(program, 'start')
            .description('Start a service.')
            .action(runServiceCommand(bbox, ctx, bbox.start));
        createServiceCommand(program, 'restart')
            .description('Restart a service.')
            .action(runServiceCommand(bbox, ctx, bbox.restart));
        createServiceCommand(program, 'stop')
            .description('Stop a service.')
            .action(runServiceCommand(bbox, ctx, bbox.stop));
        program.command('list').aliases(['ls', 'status', 'ps'])
            .description('List services.')
            .action(runCommandOpts(bbox, ctx, bbox.status));
        program.command('configure <service>').alias('config')
            .description('Run "configure" pipeline on a service.')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'configure' })));
        program.command('build <service>')
            .description('Run "build" pipeline on a service.')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'build' })));
        program.command('initialize <service>').alias('init')
            .description('Run "initialize" pipeline on a service.')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'initialize' })));
        program.command('reset <service>')
            .description('Run "reset" pipeline on a service.')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'reset' })));
        program.command('pipeline <service> [pipeline]')
            .description('Run a pipeline on a service. List all pipelines when pipeline is not provided.')
            .action(runCommand(bbox, ctx, bbox.pipelineOrListPipelines, (service, pipeline) => ({ service, pipeline })));
        program.command('task <service> [task]')
            .description('Execute a task on a service. List all tasks when task is not provided.')
            .action(runCommand(bbox, ctx, bbox.taskOrListTasks, (service, task) => ({ service, task })));
        // program.command('shell <service>')
        //   .action(runCommand(bbox, ctx, bbox.shell, (service) => ({ service })))
        this.program = program;
    }
    addCommand(cmd, action, paramsHandler) {
        this.program.command(cmd)
            .action(runCommand(this.bbox, this.ctx, action, paramsHandler));
    }
    async runArgv(argv) {
        await this.program.parseAsync(argv);
    }
    async runServiceCmd(service, cmd) {
        const argv = [...cmd.split(' '), service];
        await this.program.parseAsync(argv, { from: 'user' });
    }
}
exports.Cli = Cli;
//# sourceMappingURL=cli.js.map