#!/usr/bin/env node
const _ = require('lodash');
const BbBox = require('../src/bb-box');
const DockerComposePlugin = require('../src/plugins/docker-compose-plugin');
const GitPlugin = require('../src/plugins/git-plugin');

function createBox(cmd) {
  const logger = {
    log: (entry) => console.log(entry.msg)
  };

  const box = new BbBox({
    exec: cmd.exec
  });
  box.setLogger(logger);

  //TODO
  try {
    const plugin = new DockerComposePlugin();
    plugin.setLogger(logger);
    box.registerPlugin(plugin);
    console.log('DockerComposePlugin: enabled'); //XXX
  } catch(e) {
    console.warn('DockerComposePlugin: disabled - no docker-compose installed'); //XXX
  }

  // try {
  //   box.registerPlugin(new GitPlugin());
  //   console.log('GitPlugin: enabled'); //XXX
  // } catch(e) {
  //   console.error('GitPlugin: disabled - no git installed'); //XXX
  // }

  return box;
}

function createCommand(cmd) {
  return program.command(cmd)
    .option('--skip-dependencies', 'Skip the operation on the service dependencies')
}

async function runBoxOp(op, services, cmd) {
  const params = {
    services,
  };

  if (cmd.skipDependencies) {
    params.skipDependencies = true;
  }

  const box = createBox(cmd);

  process.on('SIGINT', async function () {
    await box.shutdown();
    process.exit(0);
  });

  if (!box[op]) {
    throw new Error(`No ${op} implemented on BbBox`);
  }

  await box[op](params);

  await box.shutdown();
}

const program = require('commander');
program
  .version(require('../package.json').version);

createCommand('install [services...]')
  .action(_.partial(runBoxOp, 'install'));

createCommand('update [services...]')
  .action(_.partial(runBoxOp, 'update'));

createCommand('start [services...]')
  .action(_.partial(runBoxOp, 'start'));

createCommand('stop [services...]')
  .action(_.partial(runBoxOp, 'stop'));

createCommand('reset [services...]')
  .action(_.partial(runBoxOp, 'reset'));

createCommand('status [services...]')
  .action(_.partial(runBoxOp, 'status'));

program.command('help')
  .action(function() {
    program.help();
  });

program.parse(process.argv);
