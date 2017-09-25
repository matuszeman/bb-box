const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');

class RuntimeLocal extends AbstractService {
  async run(params) {
    const {service, op} = this.params(params, {
      service: Joi.object(),
      op: Joi.string()
    });
    const some = service[op];

    this.shell.pushd(service.cwd);
    if (_.isFunction(some)) {
      await some(this.createContext(service));
    } else if (_.isString(some)) {
      this.shell.exec(some);
    } else {
      console.log(`[${service.name}] No ${op} operation`); //XXX
      //TODO if string execute as binary
    }
    this.shell.popd();
  }

  createContext(service) {
    let exec = _.get(this.options, 'exec', service.exec);
    if (exec) {
      exec = exec.replace('SERVICE_NAME', service.name);
    }

    return {
      name: service.name,
      cwd: service.cwd,
      shell: this.shell,
      exec: (cmd) => {
        if (exec) {
          cmd = exec.replace('CMD', cmd);
        }
        return this.shell.exec(cmd, {
          //async: true //TODO
          silent: false
        });
      },
      prompt: function() {
        return inquirer.prompt.apply(inquirer.prompt, arguments);
      },
      log: console.log, //XXX
      warn: console.warn //XXX
    }
  }

  get shell() {
    shell.config.reset();
    return shell;
  }
}

module.exports = RuntimeLocal;
