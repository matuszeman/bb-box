import {Command} from 'commander';
import {Bbox, ServiceCommandParams, FileManager, ProcessManager, Runner} from '../bbox';
import * as process from 'process';

async function createBox() {
  const fileManager = new FileManager();
  const runner = new Runner();
  const processManager = new ProcessManager();
  const bbox = new Bbox({rootPath: fileManager.discoverRootPath(process.cwd())}, fileManager, runner, processManager);
  await bbox.init();
  return bbox;
}

function createServiceCommand(program: Command, cmd) {
  return program.command(`${cmd} [services...]`)
    .option('--deps', 'TODO run with dependencies')
}

function runCommand(bbox: Bbox, handler) {
  return async (command: Command) => {
    try {
      await handler.bind(bbox)(command.opts());
    } catch(e) {
      console.error(e); //XXX
    }

    await bbox.shutdown();
  };
}

function runServiceCommand(bbox: Bbox, handler) {
  return async (services, command: Command) => {
    try {
      const commandParams: ServiceCommandParams = {
        services,
        ...command.opts()
      };
      await handler.bind(bbox)(commandParams);
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
    .action(runCommand(bbox, bbox.proxyBuild))
    //.option('--runnable <string>', 'Command to run');

  program.command('run')
    .action(runCommand(bbox, bbox.run))
    .option('--runnable <string>', 'Command to run');

  await program.parseAsync(process.argv);
})();
