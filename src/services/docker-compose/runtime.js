const {AbstractService, Joi} = require('@kapitchi/bb-service');
const os = require('os');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class DockerComposeRuntime extends AbstractService {
  constructor(docker) {
    super();

    try {
      //check if docker-compose is available on local system
      this.shell.exec('docker-compose --version', {silent: true, windowsHide: true});
    } catch (e) {
      throw new Error('Can not use DockerComposeRuntime: ' + e.stack);
    }

    this.docker = docker;
  }

  async run(params) {
    this.params(params, {
      service: Joi.object(),
      op: Joi.string(),
      ctx: Joi.object()
    });

    //we don't do `params = this.params(...)` as we want original reference of the service
    const {service, op, ctx} = params;

    const serviceName = service.dockerCompose.service;

    const fileArgs = [
      '-f docker-compose.yml'
    ];
    const platformFile = `docker-compose.${os.platform()}.yml`;
    if (this.shell.test('-f', platformFile)) {
      this.logger.log({
        level: 'info',
        msg: `Using platform file: ${platformFile}`
      });
      fileArgs.push(`-f ${platformFile}`);
    }

    switch(op) {
      case 'install':
      case 'update':
      case 'reset':
        let cmd = 'run';
        if (await this.getStatus(serviceName) === 'running') {
          cmd = 'exec';
        }

        const args = [];
        const userGroup = this.getUserGroup();
        if (userGroup) {
          args.push(`--user "${userGroup}"`);
        }

        if (cmd === 'run') {
          args.push('--rm');
          //TODO escape val?
          _.each(service.env, (val, key) => {
            args.push('-e', `${key}="${val}"`);
          });

          if (ctx.sshKeysPath) {
            //TODO this might not be even supported by the image - should be configurable at least!
            args.push(`-v ${ctx.sshKeysPath}:/home/node/.ssh`)
          }
        }

        this.spawn('docker-compose', [...fileArgs, cmd, ...args, serviceName, 'bbox', op, '--skip-dependencies'], {
          env: service.env
        });

        this.logger.log({
          level: 'info',
          msg: `${serviceName}: END`
        });
        break;
      case 'start':
        this.spawn('docker-compose', [...fileArgs, 'up', '-d', serviceName], {
          env: service.env
        });
        break;
      case 'stop':
        this.spawn('docker-compose', [...fileArgs, 'stop', serviceName], {
          env: service.env
        });
        break;
      case 'status':
        service.status = await this.getStatus(serviceName);
        break;
      default:
        throw new Error('DockerComposePlugin: Not supported operation ' + op);
    }
  }

  async getStatus(serviceName) {
    const containers = await this.docker.listContainers({
      all: 1
    });
    const container = _.find(containers, (cnt) => {
      return cnt.Labels['com.docker.compose.service'] === serviceName;
    });
    if (container) {
      return container.State;
    }
    return undefined;
  }

  /**
   * Get "user:group" of current process
   *
   * Window: process.getgid() and process.getuid() are not defined so this returns null
   *
   * @returns {null|string}
   */
  getUserGroup() {
    if (process.getgid && process.getuid) {
      return `${process.getuid()}:${process.getgid()}`;
    }
    return undefined;
  }

  spawn(cmd, args, opts) {
    //merge current process env with spawn cmd
    const env = _.defaults({}, opts.env, process.env);
    const userGroup = this.getUserGroup();
    if (userGroup) {
        env.BOX_USER = userGroup;
    }
    const cmdString = `${cmd} ${args.join(' ')}`;
    this.logger.log({
      level: 'debug',
      msg: `Executing (cwd: ${process.cwd()}): ${cmdString} `
    });
    const ret = spawnSync(cmd, args, {
      env,
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      console.error(ret); //XXX
      throw new Error('spawn error');
    }
  }

  get shell() {
    shell.config.reset();
    shell.config.silent = true;
    shell.config.fatal = true;

    return shell;
  }
}

module.exports = DockerComposeRuntime;
