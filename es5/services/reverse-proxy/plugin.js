'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { AbstractService, Joi } = require('@kapitchi/bb-service');
const _ = require('lodash');

class ReverseProxyPlugin extends AbstractService {
  constructor(reverseProxyRenderer, docker) {
    super();
    this.reverseProxyRenderer = reverseProxyRenderer;
    this.docker = docker;
    //docker run -p 8080:8080 -p 80:80 --network=host -v $PWD/traefik/traefik.toml:/etc/traefik/traefik.toml -v $PWD/traefik/rules:/rules traefik
  }

  register(box) {}

  onCli(program) {}

  onInstallAfter({ service }) {
    var _this = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this.createConfigOnEnabled(service);
    })();
  }

  onUpdateAfter({ service }) {
    var _this2 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this2.createConfigOnEnabled(service);
    })();
  }

  createConfigOnEnabled(service) {
    var _this3 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      console.log(service); //XXX
      if (!service.reverseProxy) {
        return;
      }

      yield _this3.createConfig(service);
    })();
  }

  createConfig(rootService) {
    var _this4 = this;

    return (0, _asyncToGenerator3.default)(function* () {
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

      const configFile = _this4.reverseProxyRenderer.render(data);
    })();
  }
}

module.exports = ReverseProxyPlugin;
//# sourceMappingURL=plugin.js.map