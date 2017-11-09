const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');

class ReverseProxyPlugin extends AbstractService {
  constructor(reverseProxyRenderer) {
    super();
    this.reverseProxyRenderer = reverseProxyRenderer;
  }

  register(box) {

  }

  async runInstallAfter({service}) {
    await this.createConfigOnEnabled(service);
  }

  async runUpdateAfter({service}) {
    await this.createConfigOnEnabled(service);
  }

  async createConfigOnEnabled(service) {
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
    }

    const configFile = this.reverseProxyRenderer.render(data);
  }
}

module.exports = ReverseProxyPlugin;
