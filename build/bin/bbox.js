"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const commander_1 = require("commander");
const bbox_1 = require("../bbox");
const process = require("process");
function createBox() {
    const fileManager = new bbox_1.FileManager();
    const runner = new bbox_1.Runner();
    const processManager = new bbox_1.ProcessManager();
    return new bbox_1.Bbox({ cwd: process.cwd() }, fileManager, runner, processManager);
}
function createServiceCommand(program, cmd) {
    return program.command(`${cmd} [services...]`)
        .option('--deps', 'TODO run with dependencies');
}
function runCommand(bbox, handler) {
    return async (command) => {
        try {
            await handler.bind(bbox)(command.opts());
        }
        catch (e) {
            console.error(e); //XXX
        }
        await bbox.shutdown();
    };
}
function runServiceCommand(bbox, handler) {
    return async (services, command) => {
        try {
            const commandParams = {
                services,
                ...command.opts()
            };
            await handler.bind(bbox)(commandParams);
        }
        catch (e) {
            console.error(e); //XXX
        }
        await bbox.shutdown();
    };
}
(async () => {
    const program = new commander_1.Command();
    program.passCommandToAction(true);
    program.allowUnknownOption(false);
    program.storeOptionsAsProperties(false);
    const box = await createBox();
    process.on('SIGINT', async function () {
        await box.shutdown();
        process.exit(0);
    });
    program.version(require('../../package.json').version);
    createServiceCommand(program, 'build')
        .action(runServiceCommand(box, box.build));
    createServiceCommand(program, 'start')
        .action(runServiceCommand(box, box.start));
    createServiceCommand(program, 'stop')
        .action(runServiceCommand(box, box.stop));
    createServiceCommand(program, 'migrate')
        .action(runServiceCommand(box, box.migrate));
    program.command('list')
        .action(runCommand(box, box.list));
    await program.parseAsync(process.argv);
})();
