const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');
const inquirer = require('inquirer');
const blubird = require('bluebird');
const pm2 = blubird.promisifyAll(require('pm2'));

class RuntimeLocal extends AbstractService {
  constructor() {
    super();
    this.pm2 = null;
  }

  async run(params) {
    this.params(params, {
      service: Joi.object(),
      op: Joi.string()
    });

    //need references not clones so we don't do `params = this.params()`
    const {service, op} = params;

    if (_.includes(['start', 'stop', 'status'], op)) {
      return await this.runPm2(service, op);
    }

    const some = service[op];
    const env = _.defaults({}, service.env);

    //run sync
    if (_.includes(['install', 'update', 'reset'], op)) {
      this.shell.pushd(service.cwd);

      if (_.isUndefined(some)) {
        this.logger.log({
          level: 'warn',
          msg: `[${service.name}] no "${op}" op`
        });
        return;
      }

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

    throw new Error(`Runtime local: Op "${op}" not implemented`);
  }

  /**
   * we use pm2 to start/stop processes
   * http://pm2.keymetrics.io/docs/usage/pm2-api/
   *
   * @param service
   * @param op
   * @returns {Promise.<void>}
   */
  async runPm2(service, op) {
    const pm2 = await this.pm2Connect();

    try {
      switch (op) {
        case 'start':
          const some = service[op];
          const env = _.defaults({}, service.env);

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
            this.logger.log({
              level: 'info',
              msg: `${service.name} No start op`,
            });
          }
          break;
        case 'stop':
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
          break;
        case 'status':
          const x = await pm2.describeAsync(service.name);
          service.state = undefined;
          if (!_.isEmpty(x)) {
            service.state = x[0].pm2_env.status;
          }

          break;
      }
    } finally {
      //causes problems - commented out for now
      // bb-box/node_modules/pm2/lib/Client.js:370
      // if (Client.client_sock.destroy)
      //   ^
      //
      // TypeError: Cannot read property 'destroy' of undefined
      // at Timeout._onTimeout (bb-box/node_modules/pm2/lib/Client.js:370:29)
      // at ontimeout (timers.js:469:11)
      // at tryOnTimeout (timers.js:304:5)
      // at Timer.listOnTimeout (timers.js:264:5)

      //this.pm2Disconnect();
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

  async pm2Connect() {
    if (this.pm2) {
      return this.pm2;
    }
    await pm2.connectAsync();
    console.log('>>> PM2 connected'); //XXX
    return this.pm2 = pm2;
  }

  pm2Disconnect() {
    if (this.pm2) {
      this.pm2.disconnect();
      this.pm2 = null;
    }
  }

  get shell() {
    shell.config.reset();
    shell.config.silent = true;
    return shell;
  }
}

module.exports = RuntimeLocal;
