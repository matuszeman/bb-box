module.exports = {
  name: 'all-features',
  services: {
    bbox: {
      values: {
        domain: 'local.app.garden'
      }
    },
    all: {
      dependencies: ['container-info', 'ts-app']
    }
  }
};
