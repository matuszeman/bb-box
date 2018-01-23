const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');

class SshPlugin extends AbstractService {
  constructor() {
    super();
  }

  register(box) {
    this.box = box;
  }

  onCli(program) {
  }

  async onInstallBefore(params) {
    await this._runIfEnabled(params);
  }

  async onUpdateBefore(params) {
    await this._runIfEnabled(params);
  }

  async onStatusBefore(params) {
    await this._runIfEnabled(params);
  }

  async onStartBefore(params) {
    await this._runIfEnabled(params);
  }

  async _runIfEnabled({service, ctx}) {
    if (!service.sshKeys) {
      return;
    }

    await this._ensureKeys(service, ctx);
  }

  async _ensureKeys(service, ctx) {
    const path = `${service.cwd}/.bbox/ssh-keys`;
    if (!this.shell.test('-d', path)) {
      console.log(`Creating the folder for SSH keys: ${path}`); //XXX
      this.shell.mkdir('-p', path);
    }

    const files = ['id_rsa', 'known_hosts', 'id_rsa.pub'];
    const errs = [];
    for (const file of files) {
      if (!this.shell.test('-f', `${path}/${file}`)) {
        errs.push(file);
      }
    }

    if (errs.length) {
      throw new Error('SSH files missing: ' + errs.join(', '));
    }

    //this.shell.exec(`docker run ${args.join(' ')} -v ${path}:/sshkey madhub/ssh-keygen`);
    this.shell.chmod('-R', '600', `${path}/id_rsa`);
    this.shell.chmod('-R', '600', `${path}/id_rsa.pub`);

    ctx.sshKeysPath = path;
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
