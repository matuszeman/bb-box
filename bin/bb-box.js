#!/usr/bin/env node
const _ = require('lodash');

const {dic} = require('./dic');

function createLogger(serviceName) {
  const logger = {
    log: (entry) => {
      console.log('[' + serviceName + ']' + entry.msg);
    }
  };

  return logger;
}

async function createBox(cmd) {


  dic.factoryListener = function(ins, def) {
    //console.log(def); //XXX
    if (ins.setLogger) {
      ins.setLogger(createLogger(def.name));
    }
    return ins;
  };

  dic.instance('bbBoxOpts', {});

  const box = dic.get('bbBox');

  //TODO
  try {
    const plugin = await dic.getAsync('dockerComposePlugin');
    box.registerPlugin(plugin);
    console.log('DockerComposePlugin: enabled'); //XXX
  } catch(e) {
    console.warn('DockerComposePlugin: disabled - ' + e.message); //XXX
  }

  try {
    const plugin = await dic.getAsync('reverseProxyPlugin');
    box.registerPlugin(plugin);
    console.log('ReverseProxyPlugin: enabled'); //XXX
  } catch(e) {
    console.warn('ReverseProxyPlugin: disabled - ' + e.message); //XXX
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

  const box = await createBox(cmd);

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
