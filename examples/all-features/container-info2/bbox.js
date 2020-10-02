module.exports = {
  name: 'container-info2',
  docker: {
    image: 'matuszeman/container-info',
  },
  services: {
    'container-info2': {
      port: 3001,
      containerPort: 3000,
      healthCheck: {
        waitOn: {
          resources: [
            'http-get://:3001/os'
          ]
        }
      }
    }
  }
}
