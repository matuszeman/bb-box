module.exports = {
  name: 'container-info2',
  docker: {
    image: 'matuszeman/container-info',
  },
  services: {
    'container-info2': {
      port: 3001,
      containerPort: 3000
    }
  }
}
