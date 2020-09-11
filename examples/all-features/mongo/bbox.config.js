module.exports = {
  name: 'mongo',
  docker: {
    image: 'mongo:3.6',
    volumes: {
      data: '/data/db'
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
