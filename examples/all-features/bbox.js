module.exports = {
  name: 'all-features',
  services: {
    all: {
      dependencies: [{service: 'container-info'}, {service: 'ts-app'}]
    }
  }
};
