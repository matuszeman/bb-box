const _ = require('lodash');
const globby = require('globby');
const path = require('path');
const {AbstractService, Joi} = require('@kapitchi/bb-service');
const shell = require('shelljs');
const RuntimeLocal = require('./runtime-local');

const serviceSchema = Joi.object({
  name: Joi.string()
}).options({allowUnknown: true});

class BbBox extends AbstractService {
  /**
   *
   * @param bbBoxOpts
   */
  constructor(bbBoxOpts) {
    super(bbBoxOpts, {
      cwd: Joi.string().optional().default(process.cwd()),
      exec: Joi.string().optional()
    });

    this.plugins = [];
    this.runtimes = {
      local: new RuntimeLocal()
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
  addPlugin(plugin) {
    plugin.register(this);
    this.plugins.push(plugin);
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
      services: Joi.array().optional()
    });

    const service = await this.discover();

    const ctx = {
      ran: {}
    };

    await this.run({
      service,
      op: params.op,
      ctx
    });

    if (!service.services) {
      return;
    }

    let serviceNames = _.keys(service.services);
    if (!_.isEmpty(params.services)) {
      serviceNames = _.intersection(serviceNames, params.services);
    }

    for (const serviceName of serviceNames) {
      const subService = service.services[serviceName];

      await this.run({
        service: subService,
        op: params.op,
        ctx
      });
    }

    this.outputInfo(service);
  }

  async run(params) {
    this.params(params, {
      service: serviceSchema,
      op: Joi.string().allow('install', 'update', 'start', 'stop', 'reset', 'status'),
      ctx: Joi.object()
    });

    //we don't do `params = this.params(...)` as we want original reference of the service
    const {service, op, ctx} = params;

    if (ctx.ran[service.name + params.op]) {
      return;
    }

    if (!_.isEmpty(service.dependsOn)) {
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

    ctx.ran[service.name + params.op] = true;

    const canRun = _.get(service, 'run.' + params.op);
    const serviceName = `[${service.name}@${service.runtime}]`;
    if (!_.isUndefined(canRun) && !canRun) {
      this.logger.log({
        level: 'info',
        msg: `${serviceName} Skipping ${params.op}`
      });
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

    this.logger.log({
      level: 'info',
      msg: `${serviceName} ... done`
    });
  }

  async discover(cwd) {
    if (!cwd) {
      cwd = this.options.cwd;
    }

    let ret = {};

    const filePath = cwd + '/bb-box.js';
    if (this.shell.test('-f', filePath)) {
      ret = this.loadServiceFile(filePath);
    }

    let services = await this.discoverServices(cwd);
    ret.services = _.defaultsDeep({}, ret.services, services);

    //assign parent
    for (const name in ret.services) {
      const ser = ret.services[name];
      ser.parent = ret;
      ser.env = _.defaults({}, ret.services[name].env, ret.globalEnv);
      _.defaults(ser, {
        runtime: 'local'
      });
    }

    return ret;
  }

  outputInfo(service) {
    console.log(`[${service.name}@${service.runtime}]: ${service.state}`); //XXX

    if (!service.services) {
      // this.logger.log({
      //   level: 'debug',
      //   msg: `${service.name}: No sub services`
      // });
      return;
    }

    for (const childService of Object.values(service.services)) {
      this.outputInfo(childService);
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
      const file = this.loadServiceFile(p);
      services[file.name] = file;
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
   * @returns {Promise.<void>}
   */
  async runPlugins(hook) {
    const ret = {};

    for (const plugin of this.plugins) {
      if (!_.isFunction(plugin[hook])) {
        continue;
      }

      const x = await plugin[hook]();
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
