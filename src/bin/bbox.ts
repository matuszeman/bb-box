import {Command} from 'commander';
import {Bbox, ServiceCommandParams, FileManager, ProcessManager, Runner} from '../bbox';
import * as process from 'process';

function createBox() {
  const fileManager = new FileManager();
  const runner = new Runner();
  const processManager = new ProcessManager();
  return new Bbox({cwd: process.cwd()}, fileManager, runner, processManager);
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
