#!/usr/bin/env node
const BbBox = require('../src/bb-box');

const bbBox = new BbBox();
bbBox.setLogger({
  log: (entry) => console.log(entry.msg)
});

function handleAsync(promise) {
  promise.then(() => {
    console.log('bb-box: All done.'); //XXX
  }).catch((err) => {
    console.error('bb-box error: ', err); //XXX
  })
}

const program = require('commander');
program
  .version(require('../package.json').version);

program.command('init [services...]')
  .action(function(services) {
    handleAsync(bbBox.init({
      services
    }));
  });

program.command('update [services...]')
  .action(function(services) {
    handleAsync(bbBox.update({
      services
    }));
  });

program.command('help')
  .action(function() {
    program.help();
  });

program.parse(process.argv);
