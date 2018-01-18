const {AbstractService, Joi} = require('@kapitchi/bb-service');
const YAML = require('yamljs');
const _ = require('lodash');

class DockerComposePlugin extends AbstractService {
  constructor(dockerComposeRuntime, dockerDiscovery) {
    super();
    this.runtime = dockerComposeRuntime;
    this.dockerDiscovery = dockerDiscovery;
  }

  register(box) {
    box.runtimes['docker-compose'] = this.runtime;
  }

  onCli(program) {
  }

  discoverServices() {
    try {
      const host = this.dockerDiscovery.getHost();
        
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

        if (service.ports) {
          def.expose = service.ports.map(port => {
            const ports = this.parsePorts(port);
            return {
              ip: host.ip,
              port: ports.host
            }
          });
        }

        const localService = !!service.build;
        if (!localService) {
          def.disableOps = {
            install: true,
            update: true,
            reset: true
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

  parsePorts(port) {
    const ports = port.split(':');
    if (ports.length === 2) {
      return {
        host: ports[0],
        container: ports[1]
      };
    }

    if (ports.length === 1) {
      return {
        host: ports[0],
        container: ports[0]
      };
    }

    throw new Error('Unknown port format: ' + port);
  }
}

module.exports = DockerComposePlugin;
