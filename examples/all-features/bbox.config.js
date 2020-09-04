module.exports = {
  name: 'all-features',
  services: {
    project: {
      values: {
        email: 'user@example.com'
      }
    },
    all: {
      dependencies: ['container-info', 'node']
    }
  }
};
