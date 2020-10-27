import {Bbox, Ctx} from '../bbox';
import * as process from 'process';
import { ProcessManager } from '../process-manager';
import {BboxDiscovery} from '../bbox-discovery';
import { Ui } from '../ui';
import {Cli} from '../cli';
import {Shell} from '../shell';

async function createBox() {
  const fileManager = new BboxDiscovery();
  const processManager = new ProcessManager();
  const rootPath = fileManager.discoverRootPath(process.cwd());
  const ctx: Ctx = {
    projectOpts: {
      rootPath,
      dockerComposePath: `${rootPath}/docker-compose.yml`,
    },
    stagedStates: []
  }
  const bbox = new Bbox(fileManager, processManager, new Ui());
  await bbox.init(ctx);
  return {
    bbox,
    ctx
  };
}


(async () => {
  const {bbox, ctx} = await createBox();
  process.on('SIGINT', async function () {
    await bbox.shutdown();
    process.exit(0);
  });

  const cli = new Cli(bbox, ctx);

  cli.addCommand('shell', async () => {
    const shell = new Shell(bbox, cli, ctx);
    await shell.start();
  }, () => {});

  //cli init
  await bbox.onCliInit(cli, ctx);

  await cli.runArgv(process.argv);
})();
