import {Command} from 'commander';
import {Bbox, ServiceCommandParams, Ctx} from '../bbox';
import * as process from 'process';
import { ProcessManager } from '../process-manager';
import {FileManager} from '../file-manager';

async function createBox() {
  const fileManager = new FileManager();
  const processManager = new ProcessManager();
  const rootPath = fileManager.discoverRootPath(process.cwd());
  const ctx: Ctx = {
    processList: undefined,
    projectOpts: {
      rootPath,
      proxyConfigPath: `${rootPath}/.bbox/proxy-config.json`,
      dockerComposePath: `${rootPath}/docker-compose.yml`,
      reverseProxy: {
        port: 80
      },
      domain: 'local.app.garden'
    }
  }
  const bbox = new Bbox(fileManager, processManager);
  await bbox.init(ctx);
  return {
    bbox,
    ctx
  };
}

function createServiceCommand(program: Command, cmd) {
  return program.command(`${cmd} [services...]`)
    .option('--deps', 'TODO run with dependencies')
}

function runCommand(bbox: Bbox, ctx: Ctx, handler) {
  return async (command: Command) => {
    try {
      await handler.bind(bbox)(command.opts(), ctx);
    } catch(e) {
      console.error(e); //XXX
    }

    await bbox.shutdown();
  };
}

function runServiceCommand(bbox: Bbox, ctx: Ctx, handler) {
  return async (services, command: Command) => {
    try {
      const commandParams: ServiceCommandParams = {
        services,
        ...command.opts()
      };
      await handler.bind(bbox)(commandParams, ctx);
    } catch(e) {
      console.error(e); //XXX
    }

    await bbox.shutdown();
  };
}

(async () => {
  const program = new Command() as Command;
  program.passCommandToAction(true);
  program.allowUnknownOption(false);
  program.storeOptionsAsProperties(false);

  const {bbox, ctx} = await createBox();
  process.on('SIGINT', async function () {
    await bbox.shutdown();
    process.exit(0);
  });

  program.version(require('../../package.json').version);

  createServiceCommand(program, 'build')
    .action(runServiceCommand(bbox, ctx, bbox.build));

  createServiceCommand(program, 'start')
    .action(runServiceCommand(bbox, ctx, bbox.start));

  createServiceCommand(program, 'stop')
    .action(runServiceCommand(bbox, ctx, bbox.stop));

  createServiceCommand(program, 'migrate')
    .action(runServiceCommand(bbox, ctx, bbox.migrate));

  createServiceCommand(program, 'value')
    .action(runServiceCommand(bbox, ctx, bbox.value));

  program.command('list')
    .action(runCommand(bbox, ctx, bbox.list));

  createServiceCommand(program, 'test')
    .action(runServiceCommand(bbox, ctx, bbox.test));

  // program.command('proxy')
  //   .action(runCommand(box, box.proxy));

  program.command('configure')
    .alias('c')
    .action(runCommand(bbox, ctx, bbox.configure))

  program.command('run')
    .action(runCommand(bbox, ctx, bbox.run))
    .option('--runnable <string>', 'Command to run');

  program.command('shell')
    .action(runCommand(bbox, ctx, bbox.shell))

  await program.parseAsync(process.argv);
})();
