const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');

class ReverseProxyPlugin extends AbstractService {
  constructor(reverseProxyRenderer, docker) {
    super();
    this.reverseProxyRenderer = reverseProxyRenderer;
    this.docker = docker;
    //docker run -p 8080:8080 -p 80:80 --network=host -v $PWD/traefik/traefik.toml:/etc/traefik/traefik.toml -v $PWD/traefik/rules:/rules traefik
  }

  register(box) {
  }

  onCli(program) {
  }

  async onInstallAfter({service}) {
    await this.createConfigOnEnabled(service);
  }

  async onUpdateAfter({service}) {
    await this.createConfigOnEnabled(service);
  }

  async createConfigOnEnabled(service) {
    console.log(service); //XXX
    if (!service.reverseProxy) {
      return;
    }

    await this.createConfig(service);
  }

  async createConfig(rootService) {
    const data = {
      proxies: []
    };
    for (const serviceName in rootService.services) {
      const service = rootService.services[serviceName];
      if (_.isEmpty(service.expose)) {
        continue;
      }

      //TODO we take first
      const expose = _.first(service.expose);

      data.proxies.push({
        name: service.name,
        domains: [`${service.name}.local`],
        listen: [80],
        upstream: [{
          host: _.get(expose, 'host', 'localhost'),
          port: expose.port
        }]
      });

      //console.log(data); //XXX
    }

    const configFile = this.reverseProxyRenderer.render(data);
  }
}

module.exports = ReverseProxyPlugin;
