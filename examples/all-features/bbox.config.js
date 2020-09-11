module.exports = {
  name: 'all-features',
  services: {
    project: {
      values: {
        email: 'user@example.com',
      },
      valueProviders: {
        valueProvider: 'node value-provider.js'
      }
    },
    all: {
      dependencies: ['container-info', 'ts-app']
    }
  }
};
