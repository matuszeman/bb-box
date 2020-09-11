module.exports = {
  name: 'container-info',
  docker: {
    image: 'matuszeman/container-info',
  },
  services: {
    'container-info': {
      port: 3000,
    }
  }
}
