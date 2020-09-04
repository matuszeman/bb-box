module.exports = {
  name: 'mongo',
  dockerImage: 'mongo:3.6',
  volumes: {
    data: {
      containerPath: '/data/db'
    }
  },
  services: [{
    name: 'mongo',
    port: 27017,
    healthCheck: {
      waitOn: {
        resources: [
          'tcp:27017'
        ]
      }
    }
  }]
}
