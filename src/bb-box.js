const _ = require('lodash');
const globby = require('globby');
const path = require('path');
const {AbstractService, Joi} = require('@kapitchi/bb-service');
const inquirer = require('inquirer');

class BbBox extends AbstractService {
  constructor(bbBoxOpts) {
    super(bbBoxOpts, {
      cwd: Joi.string().optional().default(process.cwd()),
    });

    this.plugins = [];
  }

  addPlugin(plugin) {
    //TODO
  }

  async init(params) {
    params = this.params(params, {
      services: Joi.array().optional()
    });

    const services = this.findServices(params.services);
    for (const service of services) {
      this.logger.log({
        level: 'info',
        msg: `Initializing ${service.name} ...`,
      });
      await this.execute(service, 'init');
      this.logger.log({
        level: 'info',
        msg: `... done`,
      });
    }
  }

  async execute(service, cmd) {
    const some = service[cmd];
    if (_.isFunction(some)) {
      await some(this);
      return;
    }

    //TODO if string execute as binary
  }

  prompt() {
    return inquirer.prompt.apply(inquirer.prompt, arguments);
  }

  findServices(services) {
    if (services) {
      //TODO only services
    }

    const paths = globby.sync('*/bb-box.js', {
      cwd: this.options.cwd,
      absolute: true
    });

    return paths.map((p) => {
      const file = require(p);
      file.name = path.basename(path.dirname(p));
      return file;
    });
  }
}

module.exports = BbBox;