const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class DockerComposeRuntime extends AbstractService {
  constructor(docker) {
    super();

    //check if docker-compose is available on local system
    this.shell.exec('docker-compose --version', {silent: true});

    this.docker = docker;
  }

  async run(params) {
    this.params(params, {
      service: Joi.object(),
      op: Joi.string()
    });

    //we don't do `params = this.params(...)` as we want original reference of the service
    const {service, op} = params;

    const serviceName = service.dockerCompose.service;

    switch(op) {
      case 'install':
      case 'update':
      case 'reset':
        let cmd = 'run';
        if (await this.getStatus(serviceName) === 'running') {
          cmd = 'exec';
        }

        const args = [`--user ${this.getUserGroup()}`];

        if (cmd === 'run') {
          args.push('--rm');
          //TODO escape val?
          _.each(service.env, (val, key) => {
            args.push(`-e ${key}=${val}`);
          });
        }

        this.logger.log({
          level: 'info',
          msg: `${serviceName}: RUNNING 'docker-compose ${cmd} <args> ${serviceName} bb-box ${op}. The below runs on the container:`
        });

        this.spawn('docker-compose', [cmd, ...args, serviceName, 'bb-box', op], {
          env: service.env
        });

        this.logger.log({
          level: 'info',
          msg: `${serviceName}: END`
        });
        break;
      case 'start':
        this.spawn('docker-compose', ['up', '-d', serviceName], {
          env: service.env
        });
        break;
      case 'stop':
        this.spawn('docker-compose', ['stop', serviceName], {
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

  getUserGroup() {
    return `${process.getuid()}:${process.getgid()}`;
  }

  spawn(cmd, args, opts) {
    //merge current process env with spawn cmd
    const env = _.defaults({
      BOX_USER: this.getUserGroup()
    }, opts.env, process.env);
    const ret = spawnSync(cmd, args, _.defaults({
      env,
      stdio: 'inherit',
      shell: true
    }, opts));
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
