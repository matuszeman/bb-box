"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const bbox_1 = require("../bbox");
const process = require("process");
async function createBox() {
    const fileManager = new bbox_1.FileManager();
    const runner = new bbox_1.Runner();
    const processManager = new bbox_1.ProcessManager();
    const bbox = new bbox_1.Bbox({ rootPath: fileManager.discoverRootPath(process.cwd()) }, fileManager, runner, processManager);
    await bbox.init();
    return bbox;
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
    const bbox = await createBox();
    process.on('SIGINT', async function () {
        await bbox.shutdown();
        process.exit(0);
    });
    program.version(require('../../package.json').version);
    createServiceCommand(program, 'build')
        .action(runServiceCommand(bbox, bbox.build));
    createServiceCommand(program, 'start')
        .action(runServiceCommand(bbox, bbox.start));
    createServiceCommand(program, 'stop')
        .action(runServiceCommand(bbox, bbox.stop));
    createServiceCommand(program, 'migrate')
        .action(runServiceCommand(bbox, bbox.migrate));
    program.command('list')
        .action(runCommand(bbox, bbox.list));
    createServiceCommand(program, 'test')
        .action(runServiceCommand(bbox, bbox.test));
    // program.command('proxy')
    //   .action(runCommand(box, box.proxy));
    program.command('proxy:build')
        .action(runCommand(bbox, bbox.proxyBuild));
    //.option('--runnable <string>', 'Command to run');
    program.command('run')
        .action(runCommand(bbox, bbox.run))
        .option('--runnable <string>', 'Command to run');
    await program.parseAsync(process.argv);
})();
//# sourceMappingURL=bbox.js.map