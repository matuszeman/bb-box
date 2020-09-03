module.exports = {
  name: 'container-info2',
  dockerImage: 'matuszeman/container-info',
  services: {
    'container-info2': {
      port: 3001,
      containerPort: 3000
    }
  }
}
