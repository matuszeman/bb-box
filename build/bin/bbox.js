"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bbox_1 = require("../bbox");
const process = require("process");
const process_manager_1 = require("../process-manager");
const bbox_discovery_1 = require("../bbox-discovery");
const ui_1 = require("../ui");
const cli_1 = require("../cli");
const shell_1 = require("../shell");
async function createBox() {
    const fileManager = new bbox_discovery_1.BboxDiscovery();
    const processManager = new process_manager_1.ProcessManager();
    const rootPath = fileManager.discoverRootPath(process.cwd());
    const ctx = {
        projectOpts: {
            rootPath,
            dockerComposePath: `${rootPath}/docker-compose.yml`,
        },
        stagedActions: [],
        ui: new ui_1.Ui()
    };
    const bbox = new bbox_1.Bbox(fileManager, processManager);
    await bbox.init(ctx);
    return {
        bbox,
        ctx
    };
}
(async () => {
    const { bbox, ctx } = await createBox();
    process.on('SIGINT', async function () {
        await bbox.shutdown();
        process.exit(0);
    });
    const cli = new cli_1.Cli(bbox, ctx);
    cli.addCommand('shell', async () => {
        const shell = new shell_1.Shell(bbox, cli, ctx);
        await shell.start();
    }, () => { });
    //cli init
    await bbox.onCliInit(cli, ctx);
    try {
        await cli.runArgv(process.argv);
    }
    catch (e) {
        //console.error(e);
    }
    finally {
        await bbox.shutdown();
    }
})();
//# sourceMappingURL=bbox.js.map