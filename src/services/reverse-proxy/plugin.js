const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');

class ReverseProxyPlugin extends AbstractService {
  constructor() {
    super();
  }

  register(box) {

  }

  async runInstallAfter({service}) {
    if (service.reverseProxy) {
      await this.createConfig(service);
    }
  }

  async runUpdateAfter({service}) {
    if (service.reverseProxy) {
      await this.createConfig(service);
    }
  }

  async createConfig(service) {
    console.log(service); //XXX
  }
}

module.exports = ReverseProxyPlugin;
