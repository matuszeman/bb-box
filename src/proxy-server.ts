import * as redbird from 'redbird';

export interface ProxyConfig {
  port: number;
  forward: {[key: string]: string};
}

const config: ProxyConfig = require(process.env.configFilePath);

const proxy = redbird({
  port: config.port
  // ssl: {
  //   http2: true,
  //   port: 443, // SSL port used to serve registered https routes with LetsEncrypt certificate.
  // }
});

for (const domain in config.forward) {
  proxy.register(domain, config.forward[domain]);
}
