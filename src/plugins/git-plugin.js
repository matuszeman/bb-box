const {AbstractService, Joi} = require('@kapitchi/bb-service');
const _ = require('lodash');
const shell = require('shelljs');
const { spawnSync } = require('child_process');

class GitPlugin extends AbstractService {
  constructor() {
    super();
  }

  register(box) {
  }


}

module.exports = GitPlugin;
