const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');
const inquirer = require('inquirer');
const blubird = require('bluebird');
const pm2 = blubird.promisifyAll(require('pm2'));

class RuntimeLocal extends AbstractService {
  async run(params) {
    this.params(params, {
      service: Joi.object(),
      op: Joi.string()
    });

    //need references not clones so we don't do `params = this.params()`
    const {service, op} = params;

    //run sync
    if (_.includes(['install', 'update', 'reset'], op)) {
      const some = service[op];
      if (_.isUndefined(some)) {
        this.logger.log({
          level: 'warn',
          msg: `[${service.name}] no "${op}" op`
        });
        return;
      }

      const env = _.defaults({}, service.env);

      this.shell.pushd(service.cwd);

      if (_.isFunction(some)) {
        await some(this.createContext(service));
      } else if (_.isString(some)) {
        this.shell.exec(some, {silent: false, env});
      } else {
        console.log(`[${service.name}] No ${op} operation`); //XXX
        //TODO if string execute as binary
      }

      this.shell.popd();
      return;
    }

    // we use pm2 to start/stop processes
    //http://pm2.keymetrics.io/docs/usage/pm2-api/
    const pm2 = await this.pm2();
    try {
      const some = service[op];
      if (op === 'start') {
        if (_.isString(some)) {
          const ret = await pm2.startAsync({
            name: service.name,
            script: some,
            cwd: service.cwd,
            force: true,
            env,
          });
          this.logger.log({
            level: 'info',
            msg: `${service.name} PM2 process started`,
          });
        } else if (_.isObject(some)) {
          _.defaults(some, {
            name: service.name,
            cwd: service.cwd,
            env,
          });

          some.force = true;

          // try {
          //   await pm2.deleteAsync(service.name);
          // } catch(e) {
          //   //ignore delete errors
          // }

          const ret = await pm2.startAsync(some);
          if (_.isEmpty(ret)) {
            throw new Error('Could not start PM2 process');
          }
          this.logger.log({
            level: 'info',
            msg: `${service.name} PM2 process started`,
          });
        } else {
          throw new Error('start options needs to be either string or object');
        }
      } else if (op === 'stop') {
        try {
          await pm2.stopAsync(service.name);
        } catch (e) {
          if (e.message !== 'process name not found') {
            throw e;
          }

          this.logger.log({
            level: 'warn',
            msg: `${service.name} PM2 process does not exist`,
          });
        }
      } else if (op === 'status') {
        const x = await pm2.describeAsync(service.name);
        service.state = undefined;
        if (!_.isEmpty(x)) {
          service.state = x[0].pm2_env.status;
        };
      } else {
        throw new Error('N/I: operation: ' + op);
      }
    } finally {
      this.pm2Disconnect();
    }
  }

  createContext(service) {
    let exec = _.get(this.options, 'exec', service.exec);
    if (exec) {
      exec = exec.replace('SERVICE_NAME', service.name);
    }

    return {
      name: service.name,
      cwd: service.cwd,
      shell: this.shell,
      exec: (cmd) => {
        if (exec) {
          cmd = exec.replace('CMD', cmd);
        }
        return this.shell.exec(cmd, {
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

  async pm2() {
    await pm2.connectAsync();
    return pm2;
  }

  pm2Disconnect() {
    pm2.disconnect();
    return pm2;
  }

  get shell() {
    shell.config.reset();
    shell.config.silent = true;
    return shell;
  }
}

module.exports = RuntimeLocal;
