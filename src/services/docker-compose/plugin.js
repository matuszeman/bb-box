const {AbstractService, Joi} = require('@kapitchi/bb-service');
const YAML = require('yamljs');
const _ = require('lodash');

class DockerComposePlugin extends AbstractService {
  constructor(dockerComposeRuntime) {
    super();
    this.runtime = dockerComposeRuntime;
  }

  register(box) {
    box.runtimes['docker-compose'] = this.runtime;
  }

  discoverServices() {
    try {
      const compose = YAML.load('docker-compose.yml');
      const ret = {};
      for (const serviceName in compose.services) {
        const service = compose.services[serviceName];

        const def = _.omitBy({
          name: serviceName,
          dockerCompose: {
            service: serviceName
          },
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

        ret[serviceName] = def;
      }

      return ret;
    } catch(e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
      return {};
    }
  }
}

module.exports = DockerComposePlugin;
