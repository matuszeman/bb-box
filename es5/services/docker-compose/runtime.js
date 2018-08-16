'use strict';

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { AbstractService, Joi } = require('@kapitchi/bb-service');
const os = require('os');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class DockerComposeRuntime extends AbstractService {
  constructor(docker) {
    super();

    try {
      //check if docker-compose is available on local system
      this.shell.exec('docker-compose --version', { silent: true, windowsHide: true });
    } catch (e) {
      throw new Error('Can not use DockerComposeRuntime: ' + e.stack);
    }

    this.docker = docker;
  }

  run(params) {
    var _this = this;

    return (0, _asyncToGenerator3.default)(function* () {
      _this.params(params, {
        service: Joi.object(),
        op: Joi.string(),
        ctx: Joi.object()
      });

      //we don't do `params = this.params(...)` as we want original reference of the service
      const { service, op, ctx } = params;

      const serviceName = service.dockerCompose.service;

      const fileArgs = ['-f docker-compose.yml'];
      const platformFile = `docker-compose.${os.platform()}.yml`;
      if (_this.shell.test('-f', platformFile)) {
        fileArgs.push(`-f ${platformFile}`);
      }

      const overwriteFile = 'docker-compose.override.yml';
      if (_this.shell.test('-f', overwriteFile)) {
        fileArgs.push(`-f ${overwriteFile}`);
      }

      switch (op) {
        case 'install':
        case 'update':
        case 'reset':
          let cmd = 'run';
          if ((yield _this.getStatus(serviceName)) === 'running') {
            cmd = 'exec';
          }

          const args = [];
          const userGroup = _this.getUserGroup();
          if (userGroup) {
            args.push(`--user "${userGroup}"`);
          }

          if (cmd === 'run') {
            args.push('--rm');
            //TODO escape val?
            _.each(service.env, function (val, key) {
              args.push('-e', `${key}="${val}"`);
            });

            if (ctx.sshKeysPath) {
              //TODO this might not be even supported by the image - should be configurable at least!
              args.push(`-v ${ctx.sshKeysPath}:/home/node/.ssh`);
            }
          }

          _this.spawn('docker-compose', [...fileArgs, cmd, ...args, serviceName, 'bbox', op, '--skip-dependencies'], {
            env: service.env
          });

          _this.logger.log({
            level: 'info',
            msg: `${serviceName}: END`
          });
          break;
        case 'start':
          _this.spawn('docker-compose', [...fileArgs, 'up', '-d', serviceName], {
            env: service.env
          });
          break;
        case 'stop':
          _this.spawn('docker-compose', [...fileArgs, 'stop', serviceName], {
            env: service.env
          });
          break;
        case 'status':
          service.status = yield _this.getStatus(serviceName);
          break;
        default:
          throw new Error('DockerComposePlugin: Not supported operation ' + op);
      }
    })();
  }

  getStatus(serviceName) {
    var _this2 = this;

    return (0, _asyncToGenerator3.default)(function* () {
      const containers = yield _this2.docker.listContainers({
        all: 1
      });
      const container = _.find(containers, function (cnt) {
        return cnt.Labels['com.docker.compose.service'] === serviceName;
      });
      if (container) {
        return container.State;
      }
      return undefined;
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

  spawn(cmd, args, opts) {
    //merge current process env with spawn cmd
    const env = _.defaults({}, opts.env, process.env);
    const userGroup = this.getUserGroup();
    if (userGroup) {
      env.BOX_USER = userGroup;
    }
    const cmdString = `${cmd} ${args.join(' ')}`;
    this.logger.log({
      level: 'debug',
      msg: `Executing (cwd: ${process.cwd()}): ${cmdString} `
    });
    const ret = spawnSync(cmd, args, {
      env,
      shell: true, //throws error without this
      stdio: 'inherit'
    });
    if (ret.status !== 0) {
      console.error(ret); //XXX
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

module.exports = DockerComposeRuntime;
//# sourceMappingURL=runtime.js.map