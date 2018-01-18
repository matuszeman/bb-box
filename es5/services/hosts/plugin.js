'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { AbstractService, Joi } = require('@kapitchi/bb-service');
const _ = require('lodash');

class HostsPlugin extends AbstractService {
  constructor() {
    super();
  }

  register(box) {
    this.box = box;
  }

  onCli(program) {
    var _this = this;

    program.command('hosts').action((0, _asyncToGenerator3.default)(function* () {
      const service = yield _this.box.discover();
      _this.showHosts(service);
    }));
  }

  showHosts(rootService) {
    const hosts = [];
    for (const serviceName in rootService.services) {
      const service = rootService.services[serviceName];
      if (_.isEmpty(service.expose)) {
        continue;
      }

      //TODO we take first
      const expose = _.first(service.expose);

      hosts.push(`${expose.ip} ${service.name} # ${service.name}:${expose.port}, docker-compose extra_hosts: - "${service.name}:${expose.ip}"`);
    }

    console.log(hosts.join("\n"));
  }
}

module.exports = HostsPlugin;
//# sourceMappingURL=plugin.js.map