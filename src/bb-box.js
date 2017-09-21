const _ = require('lodash');
const globby = require('globby');
const path = require('path');
const {AbstractService, Joi} = require('@kapitchi/bb-service');
const inquirer = require('inquirer');
const shell = require('shelljs');

//https://github.com/shelljs/shelljs#configsilent
//TODO shell.config.reset();
shell.config.silent = true;
shell.config.fatal = true;
//shell.config.verbose = true;

class BbBox extends AbstractService {
  /**
   *
   * @param bbBoxOpts
   */
  constructor(bbBoxOpts) {
    super(bbBoxOpts, {
      cwd: Joi.string().optional().default(process.cwd()),
      execFormat: Joi.string().optional()
    });

    this.plugins = [];
  }

  /**
   *
   * @param plugin
   */
  addPlugin(plugin) {
    //TODO
  }

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  async init(params) {
    params = this.params(params, {
      services: Joi.array().optional()
    });

    const {services} = this.discover(params.services);
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

  /**
   *
   * @param params
   * @returns {Promise.<void>}
   */
  async update(params) {
    params = this.params(params, {
      services: Joi.array().optional()
    });

    const {services} = this.discover();
    for (const service of services) {
      this.logger.log({
        level: 'info',
        msg: `Updating ${service.name} ...`,
      });
      await this.execute(service, 'update');
      this.logger.log({
        level: 'info',
        msg: `... done`,
      });
    }
  }

  async execute(service, cmd) {
    const some = service[cmd];
    shell.pushd(service.cwd);
    if (_.isFunction(some)) {
      await some(this.createContext(service));
    } else {
      //TODO if string execute as binary
    }
    shell.popd();
  }

  createContext(service) {
    let execFormat;
    if (this.options.execFormat) {
      execFormat = this.options.execFormat.replace('SERVICE_NAME', service.name);
    }
    return {
      name: service.name,
      cwd: service.cwd,
      shell: shell,
      exec: (cmd) => {
        if (execFormat) {
          cmd = execFormat.replace('CMD', cmd);
        }
        return shell.exec(cmd, {
          //async: true //TODO
          silent: false
        });
      },
      prompt: function() {
        return inquirer.prompt.apply(inquirer.prompt, arguments);
      },
      log: console.log, //XXX
      warn: console.warn //XXX
    }
  }

  discover() {
    let serviceManager;

    if (shell.test('-f', './docker-compose.yml')) {
      serviceManager = 'docker-compose';
    }

    const paths = globby.sync('*/bb-box.js', {
      cwd: this.options.cwd,
      absolute: true
    });

    const services = paths.map((p) => {
      const dir = path.dirname(p);

      shell.pushd(dir);
      const file = require(p);
      shell.popd();

      file.cwd = dir;
      file.name = path.basename(dir);
      return file;
    });

    return {
      serviceManager,
      services
    }
  }
}

module.exports = BbBox;