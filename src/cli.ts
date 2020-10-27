import {Command} from 'commander';
import {Bbox, Ctx, ServiceCommandParams} from './bbox';

function createServiceCommand(program: Command, cmd) {
  return program.command(`${cmd} [services...]`)
    .option('--deps', 'TODO run with dependencies')
}

function runCommandOpts(bbox: Bbox, ctx: Ctx, handler) {
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

function runCommand(bbox: Bbox, ctx: Ctx, handler, paramsHandler) {
  return async function () {
    try {
      const params = paramsHandler(...arguments);
      await handler.bind(bbox)(params, ctx);
    } catch(e) {
      console.error(e); //XXX
    }

    await bbox.shutdown();
  };
}

export class Cli {
  readonly program: Command;

  constructor(private bbox: Bbox, private ctx: Ctx) {
    const program = new Command() as Command;
    program.passCommandToAction(true);
    program.allowUnknownOption(false);
    program.storeOptionsAsProperties(false);

    program.version(require('../package.json').version);

    createServiceCommand(program, 'build')
      .action(runServiceCommand(bbox, ctx, bbox.build));

    createServiceCommand(program, 'start')
      .action(runServiceCommand(bbox, ctx, bbox.start));

    createServiceCommand(program, 'stop')
      .action(runServiceCommand(bbox, ctx, bbox.stop));

    createServiceCommand(program, 'value')
      .action(runServiceCommand(bbox, ctx, bbox.value));

    program.command('status').aliases(['list', 'ls'])
      .action(runCommandOpts(bbox, ctx, bbox.list));

    createServiceCommand(program, 'test')
      .action(runServiceCommand(bbox, ctx, bbox.test));

    program.command('configure <module>')
      .aliases(['config', 'c'])
      .action(runCommand(bbox, ctx, bbox.configure, (module) => {
        return {
          module
        }
      }))

    program.command('initialize <module>')
      .alias('init')
      .action(runCommand(bbox, ctx, bbox.initialize, (module) => {
        return {
          module
        }
      }))

    program.command('run <module>')
      .action(runCommand(bbox, ctx, bbox.run, (module, command: Command, runnable) => {
        return {
          module,
          cmd: runnable.join(' ')
        }
      }))

    this.program = program;
  }

  addCommand(cmd: string, action: Function, paramsHandler: Function) {
    this.program.command(cmd)
      .action(runCommand(this.bbox, this.ctx, action, paramsHandler));
  }

  async runArgv(argv: string[]) {
    await this.program.parseAsync(argv);
  }

  async runCmd(cmd: string) {
    const argv = cmd.split(' ');
    await this.program.parseAsync(argv);
  }
}
