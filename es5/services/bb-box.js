'use strict';

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const _ = require('lodash');
const globby = require('globby');
const fs = require('fs');
const path = require('path');
const { AbstractService, Joi } = require('@kapitchi/bb-service');
const shell = require('shelljs');

const serviceSchema = Joi.object({
  name: Joi.string()
}).options({ allowUnknown: true });

class BbBox extends AbstractService {
  /**
   *
   * @param bbBoxOpts
   */
  constructor(bbBoxOpts, runtimeLocal) {
    super(bbBoxOpts, {
      cwd: Joi.string().optional().default(process.cwd())
    });

    this.plugins = [];
    this.runtimes = {
      local: runtimeLocal
    };
  }

  setLogger(logger) {
    super.setLogger(logger);
    this.runtimes.local.setLogger(logger);
  }

  /**
   *
   * @param plugin
   */
  registerPlugin(plugin) {
    plugin.register(this);
    this.plugins.push(plugin);
  }

  shutdown() {
    var _this = this;

    return (0, _asyncToGenerator3.default)(function* () {
      for (const plugin of _this.plugins) {
        if (plugin['onUnregister']) {
          yield plugin.onUnregister();
        }
      }

      for (const runtimeName in _this.runtimes) {
        if (_this.runtimes[runtimeName]['onUnregister']) {
          yield _this.runtimes[runtimeName].onUnregister();
        }
      }
    })();
  }

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  install(params) {
    var _this2 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'install';
      return _this2.runOp(params);
    })();
  }

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  update(params) {
    var _this3 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'update';
      return _this3.runOp(params);
    })();
  }

  start(params) {
    var _this4 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'start';
      return _this4.runOp(params);
    })();
  }

  stop(params) {
    var _this5 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'stop';
      return _this5.runOp(params);
    })();
  }

  reset(params) {
    var _this6 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'reset';
      return _this6.runOp(params);
    })();
  }

  status(params) {
    var _this7 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params.op = 'status';
      return _this7.runOp(params);
    })();
  }

  runOp(params) {
    var _this8 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      params = _this8.params(params, {
        op: Joi.string().allow('install', 'update', 'start', 'stop', 'reset', 'status'),
        services: Joi.array().optional(),
        skipDependencies: Joi.boolean().optional().default(false)
      });

      const service = yield _this8.discover();

      const ctx = {
        ran: {}
      };

      let services = [];
      if (!_.isEmpty(params.services)) {
        //run on selected dependencies
        const serviceNames = _.intersection(_.keys(service.services), params.services);
        services = serviceNames.map(function (name) {
          return service.services[name];
        });
      } else {
        //run for current/parent service
        if (!params.skipDependencies) {
          const serviceNames = _.keys(service.services);
          //run on dependencies first
          services = serviceNames.map(function (name) {
            return service.services[name];
          });
        }
        //then parent service
        services.push(service);
      }

      for (const ser of services) {
        yield _this8.run({
          service: ser,
          op: params.op,
          ctx,
          skipDependencies: params.skipDependencies
        });
      }

      if (params.op === 'status') {
        _this8.outputInfo(service);
      }
    })();
  }

  run(params) {
    var _this9 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      //we want this by reference, this.params clones the params
      const { service, ctx } = params;
      params = _this9.params(params, {
        service: serviceSchema,
        op: Joi.string().allow('install', 'update', 'start', 'stop', 'reset', 'status'),
        ctx: Joi.object(),
        skipDependencies: Joi.boolean().optional().default(false)
      });

      //make sure we run a particular operation on a service once only
      if (ctx.ran[service.name + params.op]) {
        return;
      }

      const serviceName = `[${service.name}@${service.runtime}]`;

      let runDependecies = true;
      if (params.op !== 'stop') {
        yield _this9._runDependencies(ctx, service, params);
        runDependecies = false;
      }

      ctx.ran[service.name + params.op] = true;

      yield _this9.runPlugins(`on${_.upperFirst(params.op)}Before`, {
        service: params.service
      });

      let disableOp = false;
      if (_.isBoolean(service.disableOps)) {
        disableOp = service.disableOps;
      } else {
        disableOp = _.get(service, `disableOps.${params.op}`, false);
      }

      if (disableOp) {
        _this9.logger.log({
          level: 'info',
          msg: `${serviceName} Skipping ${params.op}`
        });

        if (runDependecies) {
          yield _this9._runDependencies(ctx, service, params);
        }

        return;
      }

      _this9.logger.log({
        level: 'info',
        msg: `${serviceName} ${params.op}...`
      });

      const runtime = yield _this9.getRuntime(service);
      yield runtime.run({
        service,
        op: params.op
      });

      yield _this9.runPlugins(`on${_.upperFirst(params.op)}After`, {
        service: params.service
      });

      if (service.runtime === 'local' && service.state) {
        if (!service.cwd) {
          throw new Error('Service has no "cwd" set');
        }
        fs.writeFileSync(service.cwd + '/bb-box.state.json', (0, _stringify2.default)(service.state, null, 2));
      }

      _this9.logger.log({
        level: 'info',
        msg: `${serviceName} ... done`
      });

      if (runDependecies) {
        yield _this9._runDependencies(ctx, service, params);
      }
    })();
  }

  _runDependencies(ctx, service, params) {
    var _this10 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      if (!params.skipDependencies && !_.isEmpty(service.dependsOn)) {
        for (const dep of service.dependsOn) {
          const peerService = _.get(service, `parent.services.${dep}`);
          if (!peerService) {
            throw new Error(`Unknown peer service ${dep} of ${service.name}`);
          }

          yield _this10.run({
            service: peerService,
            op: params.op,
            ctx: ctx
          });

          //start peer services for install/update
          if (params.op === 'install' || params.op === 'update') {
            yield _this10.run({
              service: peerService,
              op: 'start',
              ctx: ctx
            });
          }
        }
      }
    })();
  }

  discover(cwd) {
    var _this11 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      if (!cwd) {
        cwd = _this11.options.cwd;
      }

      let ret = {
        name: 'ROOT'
      };

      const filePath = cwd + '/bb-box.js';
      if (_this11.shell.test('-f', filePath)) {
        ret = _this11.loadServiceFile(filePath);
      }

      _.defaults(ret, {
        runtime: 'local'
      });

      let services = yield _this11.discoverServices(cwd);
      ret.services = _.defaultsDeep({}, ret.services, services);

      //normalize service properties and set the parent
      for (const name in ret.services) {
        const ser = ret.services[name];

        let expose = ser.expose;

        if (_.isInteger(ser.expose)) {
          expose = [{ port: ser.expose, host: 'localhost' }];
        } else if (_.isArray(expose)) {
          expose = expose.map(function (exp) {
            return {
              host: _.get(exp, 'host', 'localhost'),
              port: exp.port
            };
          });
        } else if (_.isUndefined(expose)) {
          _this11.logger.log({
            level: 'warn',
            msg: `Service ${name} does not have any exposed ports`
          });
        } else {
          throw new Error('Unknown expose format: ' + expose);
        }

        ser.expose = expose;

        ser.parent = ret;
        ser.env = _.defaults({}, ret.services[name].env, ret.globalEnv);
        ser.exec = _.defaults({}, ret.services[name].exec, _.get(ret, 'defaults.exec'));
        _.defaults(ser, {
          runtime: 'local'
        });
      }

      return ret;
    })();
  }

  findService(serviceName) {
    var _this12 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const service = yield _this12.discover();
      if (!service.services || !service.services[serviceName]) {
        return null;
      }
      return service.services[serviceName];
    })();
  }

  outputInfo(service) {
    console.log('=============='); //XXX
    console.log('Service status'); //XXX
    console.log('=============='); //XXX
    this.printServiceInfo(service);
  }

  printServiceInfo(service) {
    console.log(`[${service.name}@${service.runtime}]: ${service.status}`); //XXX

    if (!service.services) {
      return;
    }

    for (const childService of (0, _values2.default)(service.services)) {
      this.printServiceInfo(childService);
    }
  }

  loadServiceFile(p) {
    const dir = path.dirname(p);

    this.shell.pushd(dir);

    const file = require(p);

    const localPath = dir + '/bb-box.local.js';
    if (this.shell.test('-f', localPath)) {
      const local = require(localPath);
      _.merge(file, local);
    }

    const statePath = dir + '/bb-box.state.json';
    if (this.shell.test('-f', statePath)) {
      file.state = require(statePath);
    } else {
      file.state = {};
    }

    this.shell.popd();

    file.cwd = dir;

    if (!file.name) {
      file.name = path.basename(dir);
    }

    _.defaults(file, {
      //runtime: 'local' // cannot be set here, because docker-compose service runtime won't be set
    });

    return file;
  }

  discoverServices(cwd) {
    var _this13 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const paths = globby.sync('*/bb-box.js', {
        cwd: cwd,
        absolute: true
      });

      const services = {};
      for (const p of paths) {
        try {
          const file = _this13.loadServiceFile(p);
          services[file.name] = file;
        } catch (e) {
          _this13.logger.log({
            level: 'error',
            msg: `Service file error. Service disabled. ${p}: ${e}`
          });
        }
      }

      const pluginServices = yield _this13.runPlugins('discoverServices');

      //TODO do some magic to merge/select values from discovered plugin services
      _.defaultsDeep(services, pluginServices);

      return services;
    })();
  }

  /**
   * Must return something what can be deepMerged
   *
   * @param hook
   * @param [params]
   * @returns {Promise.<void>}
   */
  runPlugins(hook, params) {
    var _this14 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const ret = {};

      for (const plugin of _this14.plugins) {
        if (!_.isFunction(plugin[hook])) {
          continue;
        }

        const x = yield plugin[hook](params);
        _.defaultsDeep(ret, x);
      }

      return ret;
    })();
  }

  getRuntime(service) {
    var _this15 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const runtimeName = _.get(service, 'runtime', 'local');
      if (!_this15.runtimes[runtimeName]) {
        throw new Error(`No runtime registered ${runtimeName}`);
      }

      return _this15.runtimes[runtimeName];
    })();
  }

  get shell() {
    //https://github.com/shelljs/shelljs#configsilent
    shell.config.reset();
    shell.config.silent = true;
    shell.config.fatal = true;
    //shell.config.verbose = true;
    return shell;
  }
}

module.exports = BbBox;
//# sourceMappingURL=bb-box.js.map