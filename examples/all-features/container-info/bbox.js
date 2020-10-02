module.exports = {
  name: 'container-info',
  docker: {
    image: 'matuszeman/container-info',
  },
  services: {
    'container-info': {
      port: 3000,
      healthCheck: {
        waitOn: {
          resources: [
            'http-get://:3000/os'
          ]
        }
      }
    }
  }
}
