'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { AbstractService, Joi } = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');

class SshPlugin extends AbstractService {
  constructor() {
    super();
  }

  register(box) {
    this.box = box;
  }

  onCli(program) {}

  onInstallBefore(params) {
    var _this = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this._runIfEnabled(params);
    })();
  }

  onUpdateBefore(params) {
    var _this2 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this2._runIfEnabled(params);
    })();
  }

  onStatusBefore(params) {
    var _this3 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this3._runIfEnabled(params);
    })();
  }

  onStartBefore(params) {
    var _this4 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      yield _this4._runIfEnabled(params);
    })();
  }

  _runIfEnabled({ service, ctx }) {
    var _this5 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      if (!service.sshKeys) {
        return;
      }

      yield _this5._ensureKeys(service, ctx);
    })();
  }

  _ensureKeys(service, ctx) {
    var _this6 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const path = `${service.cwd}/.bbox/ssh-keys`;
      if (!_this6.shell.test('-d', path)) {
        console.log(`Creating the folder for SSH keys: ${path}`); //XXX
        _this6.shell.mkdir('-p', path);
      }

      const files = ['id_rsa', 'known_hosts', 'id_rsa.pub'];
      const errs = [];
      for (const file of files) {
        if (!_this6.shell.test('-f', `${path}/${file}`)) {
          errs.push(file);
        }
      }

      if (errs.length) {
        throw new Error('SSH files missing: ' + errs.join(', '));
      }

      //this.shell.exec(`docker run ${args.join(' ')} -v ${path}:/sshkey madhub/ssh-keygen`);
      _this6.shell.chmod('-R', '600', `${path}/id_rsa`);
      _this6.shell.chmod('-R', '600', `${path}/id_rsa.pub`);

      ctx.sshKeysPath = path;
    })();
  }

  /**
   * Get "user:group" of current process
   *
   * Window: process.getgid() and process.getuid() are not defined so this returns null
   *
   * @returns {null|string}
   */
  getUserGroup() {
    if (process.getgid && process.getuid) {
      return `${process.getuid()}:${process.getgid()}`;
    }
    return undefined;
  }

  get shell() {
    shell.config.reset();
    shell.config.fatal = true;

    return shell;
  }
}

module.exports = SshPlugin;
//# sourceMappingURL=plugin.js.map