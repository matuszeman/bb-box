#!/usr/bin/env node
var semver = require('semver');

if (semver.gte(process.version, '7.6.0')) {
  console.log('Running from src'); //XXX
  require('../src/bin/bb-box');
} else {
  console.log('Running from es5'); //XXX
  require('../es5/bin/bb-box');
}
