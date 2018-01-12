'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const Docker = require('dockerode');

module.exports = (0, _asyncToGenerator3.default)(function* () {
  const docker = new Docker();

  // test connection to docker engine
  yield docker.listContainers();

  return docker;
});
//# sourceMappingURL=docker.async-factory.js.map