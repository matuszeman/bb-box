export default {
  name: 'bbox-proxy',
  services: {
    'bbox-proxy': {
      subServices: {
        http: {
          name: 'http',
          port: 80
        },
        https: {
          name: 'https',
          port: 443
        }
      },
      start: 'node proxy-server.js'
    }
  }
}
