import {Command} from 'commander';
import {Bbox, Ctx, ServiceCommandParams} from './bbox';

function createServiceCommand(program: Command, cmd) {
  return program.command(`${cmd} <service>`)
    .option('--deps', 'TODO run with dependencies')
}

function runCommandOpts(bbox: Bbox, ctx: Ctx, handler) {
  return async (command: Command) => {
    try {
      await handler.bind(bbox)(command.opts(), ctx);
      //await bbox.status({}, ctx);
    } catch(e) {
      console.error(e); //XXX
    }
  };
}

function runServiceCommand(bbox: Bbox, ctx: Ctx, handler) {
  return async (service, command: Command) => {
    try {
      const commandParams: ServiceCommandParams = {
        service,
        ...command.opts()
      };
      await handler.bind(bbox)(commandParams, ctx);
      //await bbox.status({}, ctx);
    } catch(e) {
      console.error(e); //XXX
    }
  };
}

function runCommand(bbox: Bbox, ctx: Ctx, handler, paramsHandler) {
  return async function () {
    try {
      const params = paramsHandler(...arguments);
      await handler.bind(bbox)(params, ctx);
      //await bbox.status({}, ctx);
    } catch(e) {
      console.error(e); //XXX
    }
  };
}

export class Cli {
  readonly program: Command;

  constructor(private bbox: Bbox, private ctx: Ctx) {
    const program = new Command() as Command;
    //program.exitOverride();
    program.passCommandToAction(true);
    program.allowUnknownOption(false);
    program.storeOptionsAsProperties(false);

    program.version(require('../package.json').version);

    createServiceCommand(program, 'start')
      .action(runServiceCommand(bbox, ctx, bbox.start));

    createServiceCommand(program, 'stop')
      .action(runServiceCommand(bbox, ctx, bbox.stop));

    program.command('status').aliases(['ps'])
      .action(runCommandOpts(bbox, ctx, bbox.status));

    createServiceCommand(program, 'test')
      .action(runServiceCommand(bbox, ctx, bbox.test));

    program.command('pipeline <service>')
      .aliases(['pi'])
      .action(runCommand(bbox, ctx, bbox.listPipelines, (service) => ({ service })))

    program.command('configure <service>')
      .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'configure' })))

    program.command('build <service>')
      .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'build' })))

    program.command('initialize <service>')
      .action(runCommand(bbox, ctx, bbox.pipeline, (service) => ({ service, pipeline: 'initialize' })))

    program.command('pipeline <service> <pipeline>')
      .aliases(['pi'])
      .action(runCommand(bbox, ctx, bbox.pipeline, (service, pipeline) => ({ service, pipeline })))

    program.command('task <service>')
      .aliases(['ta'])
      .action(runCommand(bbox, ctx, bbox.listTasks, (service) => ({ service })))

    program.command('task <service> <task>')
      .action(runCommand(bbox, ctx, bbox.task, (service, task) => ({ service, task })))

    this.program = program;
  }

  addCommand(cmd: string, action: Function, paramsHandler: Function) {
    this.program.command(cmd)
      .action(runCommand(this.bbox, this.ctx, action, paramsHandler));
  }

  async runArgv(argv: string[]) {
    await this.program.parseAsync(argv);
  }

  async runServiceCmd(service: string, cmd: string) {
    const argv = [...cmd.split(' '), service];
    await this.program.parseAsync(argv, {from: 'user'});
  }
}
