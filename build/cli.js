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
            const commandParams = {
                service,
                ...command.opts()
            };
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
            .action(runServiceCommand(bbox, ctx, bbox.start));
        createServiceCommand(program, 'restart')
            .action(runServiceCommand(bbox, ctx, bbox.restart));
        createServiceCommand(program, 'stop')
            .action(runServiceCommand(bbox, ctx, bbox.stop));
        program.command('status').aliases(['ps'])
            .action(runCommandOpts(bbox, ctx, bbox.status));
        createServiceCommand(program, 'test')
            .action(runServiceCommand(bbox, ctx, bbox.test));
        program.command('configure <service>').alias('config')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'configure' })));
        program.command('build <service>')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'build' })));
        program.command('initialize <service>').alias('init')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'initialize' })));
        program.command('reset <service>')
            .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'reset' })));
        program.command('pipeline <service> [pipeline]')
            .action(runCommand(bbox, ctx, bbox.pipelineOrListPipelines, (service, pipeline) => ({ service, pipeline })));
        program.command('task <service> [task]')
            .action(runCommand(bbox, ctx, bbox.taskOrListTasks, (service, task) => ({ service, task })));
        program.command('shell <service>')
            .action(runCommand(bbox, ctx, bbox.shell, (service) => ({ service })));
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