#!/usr/bin/env node
const BbBox = require('../src/bb-box');
const DockerComposePlugin = require('../src/plugins/docker-compose-plugin');
const GitPlugin = require('../src/plugins/git-plugin');

function createBox(cmd) {
  const box = new BbBox({
    exec: cmd.exec
  });

  //TODO
  try {
    box.addPlugin(new DockerComposePlugin());
    console.log('DockerComposePlugin: enabled'); //XXX
  } catch(e) {
    console.error('DockerComposePlugin: disabled - no docker-compose installed'); //XXX
  }

  // try {
  //   box.addPlugin(new GitPlugin());
  //   console.log('GitPlugin: enabled'); //XXX
  // } catch(e) {
  //   console.error('GitPlugin: disabled - no git installed'); //XXX
  // }

  box.setLogger({
    log: (entry) => console.log(entry.msg)
  });
  return box;
}

function handleAsync(promise) {
  promise.then(() => {
    console.log('bb-box: All done.'); //XXX
  }).catch((err) => {
    console.error('bb-box error: ', err); //XXX
    process.exitCode = 1;
  })
}

function createCommand(cmd) {
  return program.command(cmd)
    .option('--exec <format>', 'ctx.exec() format. Example: docker-compose run --rm SERVICE_NAME CMD')
}

const program = require('commander');
program
  .version(require('../package.json').version);

createCommand('install [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox(cmd).install({
      services,
    }));
  });

createCommand('update [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox(cmd).update({
      services
    }));
  });

createCommand('start [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox(cmd).start({
      services
    }));
  });

createCommand('stop [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox(cmd).stop({
      services
    }));
  });

createCommand('status [services...]')
  .action(function(services, cmd) {
    handleAsync(createBox(cmd).status({
      services
    }));
  });

program.command('help')
  .action(function() {
    program.help();
  });

program.parse(process.argv);
