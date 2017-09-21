#!/usr/bin/env node
const BbBox = require('../src/bb-box');

function createBox(params) {
  const bbBox = new BbBox(params);
  bbBox.setLogger({
    log: (entry) => console.log(entry.msg)
  });
  return bbBox;
}

function handleAsync(promise) {
  promise.then(() => {
    console.log('bb-box: All done.'); //XXX
  }).catch((err) => {
    console.error('bb-box error: ', err); //XXX
  })
}

function createCommand(cmd) {
  return program.command(cmd)
    .option('--exec-format <format>', 'ctx.exec() format. Example: docker-compose run --rm SERVICE_NAME CMD')
}

const program = require('commander');
program
  .version(require('../package.json').version);

createCommand('init [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox({
      execFormat: cmd.execFormat
    }).init({
      services,
    }));
  });

createCommand('update [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox({
      execFormat: cmd.execFormat
    }).update({
      services
    }));
  });

program.command('help')
  .action(function() {
    program.help();
  });

program.parse(process.argv);
