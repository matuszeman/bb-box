const _ = require('lodash');
const globby = require('globby');
const fs = require('fs');
const path = require('path');
const {AbstractService, Joi} = require('@kapitchi/bb-service');
const shell = require('shelljs');

const serviceSchema = Joi.object({
  name: Joi.string()
}).options({allowUnknown: true});

class BbBox extends AbstractService {
  /**
   *
   * @param bbBoxOpts
   */
  constructor(bbBoxOpts, runtimeLocal) {
    super(bbBoxOpts, {
      cwd: Joi.string().optional().default(process.cwd()),
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

  async shutdown() {
    for (const plugin of this.plugins) {
      if (plugin['onUnregister']) {
        await plugin.onUnregister();
      }
    }

    for (const runtimeName in this.runtimes) {
      if (this.runtimes[runtimeName]['onUnregister']) {
        await this.runtimes[runtimeName].onUnregister();
      }
    }
  }

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  async install(params) {
    params.op = 'install';
    return this.runOp(params);
  }

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  async update(params) {
    params.op = 'update';
    return this.runOp(params);
  }

  async start(params) {
    params.op = 'start';
    return this.runOp(params);
  }

  async stop(params) {
    params.op = 'stop';
    return this.runOp(params);
  }

  async reset(params) {
    params.op = 'reset';
    return this.runOp(params);
  }

  async status(params) {
    params.op = 'status';
    return this.runOp(params);
  }

  async runOp(params) {
    params = this.params(params, {
      op: Joi.string().allow('install', 'update', 'start', 'stop', 'reset', 'status'),
      services: Joi.array().optional(),
      skipDependencies: Joi.boolean().optional().default(false)
    });

    const service = await this.discover();

    const ctx = {
      ran: {}
    };

    let services = [];
    if (!_.isEmpty(params.services)) {
      //run on selected dependencies
      const serviceNames = _.intersection(_.keys(service.services), params.services);
      services = serviceNames.map(name => {
        return service.services[name];
      });
    }
    else {
      //run for current/parent service
      if (!params.skipDependencies) {
        const serviceNames = _.keys(service.services);
        //run on dependencies first
        services = serviceNames.map(name => {
          return service.services[name];
        });
      }
      //then parent service
      services.push(service);
    }

    for (const ser of services) {
      await this.run({
        service: ser,
        op: params.op,
        ctx,
        skipDependencies: params.skipDependencies
      });
    }

    if (params.op === 'status') {
      this.outputInfo(service);
    }
  }

  async run(params) {
    //we want this by reference, this.params clones the params
    const {service, ctx} = params;
    params = this.params(params, {
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
      await this._runDependencies(ctx, service, params);
      runDependecies = false;
    }

    ctx.ran[service.name + params.op] = true;

    await this.runPlugins(`on${_.upperFirst(params.op)}Before`, {
      service: params.service,
    });

    let disableOp = false;
    if (_.isBoolean(service.disableOps)) {
      disableOp = service.disableOps;
    } else {
      disableOp = _.get(service, `disableOps.${params.op}`, false);
    }

    if (disableOp) {
      this.logger.log({
        level: 'info',
        msg: `${serviceName} Skipping ${params.op}`
      });

      if (runDependecies) {
        await this._runDependencies(ctx, service, params);
      }

      return;
    }

    this.logger.log({
      level: 'info',
      msg: `${serviceName} ${params.op}...`
    });

    const runtime = await this.getRuntime(service);
    await runtime.run({
      service,
      op: params.op
    });

    await this.runPlugins(`on${_.upperFirst(params.op)}After`, {
      service: params.service,
    });

    if (service.runtime === 'local' && service.state) {
      if (!service.cwd) {
        throw new Error('Service has no "cwd" set');
      }
      fs.writeFileSync(service.cwd + '/bb-box.state.json', JSON.stringify(service.state, null, 2));
    }

    this.logger.log({
      level: 'info',
      msg: `${serviceName} ... done`
    });

    if (runDependecies) {
      await this._runDependencies(ctx, service, params);
    }
  }

  async _runDependencies(ctx, service, params) {
    if (!params.skipDependencies && !_.isEmpty(service.dependsOn)) {
      for (const dep of service.dependsOn) {
        const peerService = _.get(service, `parent.services.${dep}`);
        if (!peerService) {
          throw new Error(`Unknown peer service ${dep} of ${service.name}`);
        }

        await this.run({
          service: peerService,
          op: params.op,
          ctx: ctx
        });

        //start peer services for install/update
        if (params.op === 'install' || params.op === 'update') {
          await this.run({
            service: peerService,
            op: 'start',
            ctx: ctx
          });
        }
      }
    }
  }

  async discover(cwd) {
    if (!cwd) {
      cwd = this.options.cwd;
    }

    let ret = {
      name: 'ROOT'
    };

    const filePath = cwd + '/bb-box.js';
    if (this.shell.test('-f', filePath)) {
      ret = this.loadServiceFile(filePath);
    }

    _.defaults(ret, {
      runtime: 'local'
    });

    let services = await this.discoverServices(cwd);
    ret.services = _.defaultsDeep({}, ret.services, services);

    //normalize service properties and set the parent
    for (const name in ret.services) {
      const ser = ret.services[name];

      let expose = ser.expose;

      if (_.isInteger(ser.expose)) {
        expose = [
          {port: ser.expose, host: 'localhost'}
        ];
      } else if (_.isArray(expose)) {
        expose = expose.map(exp => {
          return {
            host: _.get(exp, 'host', 'localhost'),
            port: exp.port
          }
        });
      } else if (_.isUndefined(expose)) {
        this.logger.log({
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
  }

  async findService(serviceName) {
    const service = await this.discover();
    if (!service.services || !service.services[serviceName]) {
      return null;
    }
    return service.services[serviceName];
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

    for (const childService of Object.values(service.services)) {
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

  async discoverServices(cwd) {
    const paths = globby.sync('*/bb-box.js', {
      cwd: cwd,
      absolute: true
    });

    const services = {};
    for (const p of paths) {
      try {
        const file = this.loadServiceFile(p);
        services[file.name] = file;
      } catch (e) {
        throw new Error(`Service file error. Service disabled. ${p}: ${e}\n${e.stack}`);
      }
    }

    const pluginServices = await this.runPlugins('discoverServices');

    //TODO do some magic to merge/select values from discovered plugin services
    _.defaultsDeep(services, pluginServices);

    return services;
  }

  /**
   * Must return something what can be deepMerged
   *
   * @param hook
   * @param [params]
   * @returns {Promise.<void>}
   */
  async runPlugins(hook, params) {
    const ret = {};

    for (const plugin of this.plugins) {
      if (!_.isFunction(plugin[hook])) {
        continue;
      }

      const x = await plugin[hook](params);
      _.defaultsDeep(ret, x);
    }

    return ret;
  }

  async getRuntime(service) {
    const runtimeName = _.get(service, 'runtime', 'local');
    if (!this.runtimes[runtimeName]) {
      throw new Error(`No runtime registered ${runtimeName}`);
    }

    return this.runtimes[runtimeName];
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
