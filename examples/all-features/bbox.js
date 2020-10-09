module.exports = {
  name: 'all-features',
  services: {
    bbox: {
      values: {
        domain: 'local.app.garden'
      },
      valueProviders: {
        'val': 'node value-provider.js'
      }
    },
    all: {
      dependencies: ['container-info', 'ts-app']
    }
  }
};
