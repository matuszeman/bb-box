module.exports = {
  name: 'php-server',
  docker: {
    file: 'Dockerfile'
  },
  services: {
    'php-app': {
      start: 'php -S 0.0.0.0:9001',
      port: 9001,
    }
  }
}
