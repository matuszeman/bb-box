const {AbstractService, Joi} = require('@kapitchi/bb-service');
const YAML = require('yamljs');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class DockerComposePlugin extends AbstractService {
  constructor() {
    super();

    //check if docker-compose is available on local system
    this.shell.exec('docker-compose --version', {silent: true});
  }

  register(box) {
    box.runtimes['docker-compose'] = this;
  }

  async run(params) {
    const {service, op} = this.params(params, {
      service: Joi.object(),
      op: Joi.string()
    });

    switch(op) {
      case 'install':
      case 'update':
      case 'reset':
        this.logger.log({
          level: 'info',
          msg: `DockerComposePlugin[${service.dockerImageName}]: START`
        });

        this.spawn('docker-compose', ['run', '--rm', service.dockerImageName, 'bb-box', op]);

        this.logger.log({
          level: 'info',
          msg: `DockerComposePlugin[${service.dockerImageName}]: END`
        });
        break;
      case 'start':
        this.spawn('docker-compose', ['up', '-d', service.dockerImageName]);
        break;
      case 'stop':
        this.spawn('docker-compose', ['stop', service.dockerImageName]);
        break;
      default:
        throw new Error('DockerComposePlugin: Not supported operation ' + op);
    }
  }

  discoverServices() {
    try {
      const compose = YAML.load('docker-compose.yml');
      const ret = {};
      for (const serviceName in compose.services) {
        const service = compose.services[serviceName];

        const def = _.omitBy({
          name: serviceName,
          dockerImageName: serviceName,
          runtime: 'docker-compose',
          dependsOn: service.depends_on
        }, _.isUndefined);

        const localService = !!service.build;
        if (!localService) {
          def.run = {
            install: false,
            update: false,
            reset: false,
            start: true,
            stop: true
          };
        }

        ret[serviceName] = def
      }

      return ret;
    } catch(e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
      return {};
    }
  }

  spawn(cmd, args) {
    const ret = spawnSync(cmd, args, {
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
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

module.exports = DockerComposePlugin;
