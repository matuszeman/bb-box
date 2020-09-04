import * as path from 'path';
import * as fs from 'fs';
import * as redbird from 'redbird';

export interface ProxyConfig {
  port: number;
  forward: {[key: string]: string};
}

const config: ProxyConfig = require(process.env.configFilePath);
const rootPath = path.dirname(process.env.configFilePath);

const proxy = redbird({
  port: config.port,
  ssl: {
    http2: true,
    port: 443,
    cert: `${rootPath}/certs/cert.crt`,
    key: `${rootPath}/certs/cert.key`
  }
});

for (const domain in config.forward) {
  proxy.register(domain, config.forward[domain]);
}
