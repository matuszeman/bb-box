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

  onUnregister() {
    this.pm2Disconnect();
  }

  async run(params) {
    this.params(params, {
      service: Joi.object(),
      op: Joi.string(),
      ctx: Joi.object()
    });

    //need references not clones so we don't do `params = this.params()`
    const {service, op} = params;

    if (_.includes(['start', 'stop', 'status'], op)) {
      return await this.runPm2(service, op);
    }

    const some = service[op];

    //run sync
    if (_.includes(['install', 'update', 'reset'], op)) {
      const processEnv = _.clone(process.env);
      process.env = _.defaults({}, service.env, process.env);

      this.shell.pushd(service.cwd);

      // We run install/update dependencies.
      // On 'update' op, when updateDependencies is not available we default to installDependencies
      let deps = null;
      if (op === 'install') {
        deps = service['installDependencies'];
      }
      else if (op === 'update') {
        deps = service['updateDependencies'];
        if (_.isUndefined(deps)) {
          deps = service['installDependencies'];
        }
      }

      if (deps) {
        console.log('Running deps install/update...'); //XXX
        await this.runOperation(service, deps);
      }

      //END

      //run migrations
      if (op === 'install' || op === 'update') {
        await this.runMigrations(service);
      }

      //run the operation itself
      if (some) {
        await this.runOperation(service, some);
      } else {
        this.logger.log({
          level: 'warn',
          msg: `[${service.name}] no "${op}" op`
        });
      }

      process.env = processEnv;
      this.shell.popd();
      return;
    }

    throw new Error(`Runtime local: Op "${op}" not implemented`);
  }

  async runOperation(service, some) {
    if (_.isArray(some)) {
      for (const one of some) {
        await this.runOperation(service, one);
      }
      return;
    }

    if (_.isFunction(some)) {
      await some(this.createContext(service));
      return;
    }

    if (_.isString(some)) {
      const {cmd, opts} = this.execOpts(service, some);
      opts.silent = false;
      this.shell.exec(cmd, opts);
      return;
    }

    console.error(some); //XXX
    throw new Error('Can not run operation implemented as ' + typeof some);
  }

  async runMigrations(service) {
    if (!service.migrations) {
      return;
    }

    const lastMigrationIndex = _.get(service, 'state.lastMigration', -1);

    for (let migIndex in service.migrations) {
      migIndex = parseInt(migIndex);
      const mig = service.migrations[migIndex];
      const migName = `${migIndex} ${mig.description ? '- ' + mig.description : '(no description)'}`;

      if (migIndex <= lastMigrationIndex) {
        console.log(`Skipping migration ${migName}`);
        continue;
      }

      const ctx = this.createContext(service);
      try {
        console.log(`Running migration: ${migName}`);
        await mig.up(ctx);
        service.state.lastMigration = migIndex
        console.log('... done'); //XXX
      } catch(e) {
        console.error('Migration error', e); //XXX
        if (!mig.down) {
          console.warn('No migration down');
          return;
        }

        try {
          await mig.down(ctx);
        } catch(e) {
          console.error('Migration down error: ', e); //XXX
          throw e;
        }
      }
    }
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
    const pm2 = await this.pm2Connect(service);

    switch (op) {
      case 'start':
        const startOp = service[op];
        const env = _.defaults({}, service.env);

        // file path to PM2 ecosystem file
        if (_.isString(startOp)) {
          this.shell.pushd(service.cwd);
          try {
            // const runSpec = {
            //   name: service.name,
            //   script: some,
            //   cwd: service.cwd,
            //   //interpreter: 'none',
            //   //force: true,
            //   env,
            // };
            // https://pm2.keymetrics.io/docs/usage/pm2-api/
            const ret = await pm2.startAsync({
              script: startOp,
              name: service.name,
              env
            });
            if (_.isEmpty(ret)) {
              throw new Error('Could not start PM2 process');
            }
            this.logger.log({
              level: 'info',
              msg: `${service.name} PM2 process started`,
            });
          } catch(e) {
            console.log(e); //XXX
            throw e;
          }
          this.shell.popd();
        } else if (_.isObject(startOp)) {
          const pm2Process = _.defaults({}, startOp, {
            name: service.name,
            cwd: service.cwd,
            env,
          });

          //pm2Process.force = true;

          // try {
          //   await pm2.deleteAsync(service.name);
          // } catch(e) {
          //   //ignore delete errors
          // }

          try {
            const ret = await pm2.startAsync(pm2Process);

            if (_.isEmpty(ret)) {
              throw new Error('Could not start PM2 process');
            }
            this.logger.log({
              level: 'info',
              msg: `${service.name} PM2 process started`,
            });
          } catch (e) {
            console.log(e); //XXX
            throw e;
          }
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
          if (e.message !== 'process or namespace not found') {
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
        service.status = undefined;
        if (!_.isEmpty(x)) {
          service.status = x[0].pm2_env.status === 'online' ? 'running' : 'stopped';
        }

        break;
    }
  }

  createContext(service) {
    return {
      name: service.name,
      cwd: service.cwd,
      shell: this.shell,
      exec: (c) => {
        const {cmd, opts} = this.execOpts(service, c);
        return this.shell.exec(cmd, opts);
      },
      prompt: function() {
        return inquirer.prompt.apply(inquirer.prompt, arguments);
      },
      log: console.log, //XXX
      warn: console.warn //XXX
    }
  }

  execOpts(service, cmd) {
    const cmdPlaceholder = '${CMD}';
    const template = _.get(service, 'exec.template', cmdPlaceholder);
    const env = _.defaults({}, service.env, process.env);
    const opts = _.defaults({}, _.omit(service.exec, 'template'), {
      //async: true //TODO
      silent: false,
      windowsHide: true, //do not open terminal window on Windows
      env
    });

    cmd = template.replace(cmdPlaceholder, cmd);
    return {
      cmd,
      opts
    }
  }

  async pm2Connect(service) {
    if (!this.pm2) {
      await pm2.connectAsync();
      console.log('>>> PM2 connected'); //XXX
      this.pm2 = pm2;
    }

    this.pm2.absolutePath = service.cwd;

    return this.pm2;
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
