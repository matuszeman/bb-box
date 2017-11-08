const Docker = require('dockerode');

module.exports = async function() {
  const docker = new Docker();

  // test connection to docker engine
  await docker.listContainers();

  return docker;
};
