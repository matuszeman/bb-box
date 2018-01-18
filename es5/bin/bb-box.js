#!/usr/bin/env node
'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

let createBox = (() => {
  var _ref = (0, _asyncToGenerator3.default)(function* (program) {
    dic.factoryListener = function (ins, def) {
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
      const plugin = yield dic.getAsync('dockerComposePlugin');
      box.registerPlugin(plugin);
      plugin.onCli(program);
      console.log('DockerComposePlugin: enabled'); //XXX
    } catch (e) {
      console.warn('DockerComposePlugin: disabled - ' + e.message); //XXX
    }

    try {
      const plugin = yield dic.getAsync('reverseProxyPlugin');
      box.registerPlugin(plugin);
      plugin.onCli(program);
      console.log('ReverseProxyPlugin: enabled'); //XXX
    } catch (e) {
      console.warn('ReverseProxyPlugin: disabled - ' + e.message); //XXX
    }

    try {
      const plugin = yield dic.getAsync('hostsPlugin');
      box.registerPlugin(plugin);
      plugin.onCli(program);
      console.log('HostsPlugin: enabled'); //XXX
    } catch (e) {
      console.warn('HostsPlugin: disabled - ' + e.message); //XXX
    }

    // try {
    //   box.registerPlugin(new GitPlugin());
    //   console.log('GitPlugin: enabled'); //XXX
    // } catch(e) {
    //   console.error('GitPlugin: disabled - no git installed'); //XXX
    // }

    return box;
  });

  return function createBox(_x) {
    return _ref.apply(this, arguments);
  };
})();

let runBoxOp = (() => {
  var _ref2 = (0, _asyncToGenerator3.default)(function* (box, op, services, cmd) {
    const params = {
      services
    };

    if (cmd.skipDependencies) {
      params.skipDependencies = true;
    }

    process.on('SIGINT', (0, _asyncToGenerator3.default)(function* () {
      yield box.shutdown();
      process.exit(0);
    }));

    if (!box[op]) {
      throw new Error(`No ${op} implemented on BbBox`);
    }

    try {
      yield box[op](params);
    } catch (e) {
      console.error(e); //XXX
    }

    yield box.shutdown();
  });

  return function runBoxOp(_x2, _x3, _x4, _x5) {
    return _ref2.apply(this, arguments);
  };
})();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const _ = require('lodash');

const { dic } = require('./dic');

function createLogger(serviceName) {
  const logger = {
    log: entry => {
      console.log('[' + serviceName + '] ' + entry.msg);
    }
  };

  return logger;
}

function createCommand(program, cmd) {
  return program.command(cmd).option('--skip-dependencies', 'Skip the operation on the service dependencies');
}

(0, _asyncToGenerator3.default)(function* () {
  const program = require('commander');

  const box = yield createBox(program);

  program.version(require('../../package.json').version);

  createCommand(program, 'install [services...]').action(_.partial(runBoxOp, box, 'install'));

  createCommand(program, 'update [services...]').action(_.partial(runBoxOp, box, 'update'));

  createCommand(program, 'start [services...]').action(_.partial(runBoxOp, box, 'start'));

  createCommand(program, 'stop [services...]').action(_.partial(runBoxOp, box, 'stop'));

  createCommand(program, 'reset [services...]').action(_.partial(runBoxOp, box, 'reset'));

  createCommand(program, 'status [services...]').action(_.partial(runBoxOp, box, 'status'));

  program.command('help').action(function () {
    program.help();
  });

  program.parse(process.argv);
})();
//# sourceMappingURL=bb-box.js.map