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

  async status(params) {
    params = this.params(params, {
      services: Joi.array()
    });

    const service = await this.discover();
    console.log(service); //XXX
    //console.log(JSON.stringify(service, null, 2)); //XXX
  }

  async runOp(params) {
    params = this.params(params, {
      op: Joi.string().allow('install', 'update', 'start', 'stop'),
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
  }

  async run(params) {
    params = this.params(params, {
      service: serviceSchema,
      op: Joi.string().allow('install', 'update', 'start', 'stop'),
      ctx: Joi.object()
    });

    const {service, ctx} = params;

    if (ctx.ran[service.name]) {
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
      }
    }

    ctx.ran[service.name] = true;

    const canRun = _.get(service, 'run.' + params.op);
    if (!_.isUndefined(canRun) && !canRun) {
      this.logger.log({
        level: 'info',
        msg: `[${service.name}] Skipping ${params.op}`
      });
      return;
    }

    this.logger.log({
      level: 'info',
      msg: `[${service.name}] ${params.op}...`
    });

    const runtime = await this.getRuntime(service);
    await runtime.run({
      service,
      op: params.op
    });

    this.logger.log({
      level: 'info',
      msg: `[${service.name}] ... done`
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
      ret.services[name].parent = ret;
    }

    return ret;
  }

  loadServiceFile(p) {
    const dir = path.dirname(p);

    this.shell.pushd(dir);
    const file = require(p);
    this.shell.popd();

    file.cwd = dir;

    if (!file.name) {
      file.name = path.basename(dir);
    }

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
