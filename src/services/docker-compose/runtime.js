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
        this.logger.log({
          level: 'info',
          msg: `DockerComposePlugin[${serviceName}]: START`
        });

        this.spawn('docker-compose', ['run', '--rm', serviceName, 'bb-box', op], {
          env: service.env
        });

        this.logger.log({
          level: 'info',
          msg: `DockerComposePlugin[${serviceName}]: END`
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
        const containers = await this.docker.listContainers({
          all: 1
        });
        const container = _.find(containers, (cnt) => {
          return cnt.Labels['com.docker.compose.service'] === serviceName;
        });
        service.status = undefined;
        if (container) {
          service.status = container.State;
        }
        break;
      default:
        throw new Error('DockerComposePlugin: Not supported operation ' + op);
    }
  }

  spawn(cmd, args, opts) {
    const ret = spawnSync(cmd, args, _.defaults({
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
