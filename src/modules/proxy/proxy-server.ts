import * as redbird from 'redbird';

export interface ProxyConfig {
  httpPort: number;
  httpsPort: number;
  forward: {[key: string]: string};
}

const configPath = process.env.BBOX_PATH;
const configFilePath = `${configPath}/proxy-config.json`;
const certPath = `${configPath}/state/cert.crt`;
const keyPath = `${configPath}/state/cert.key`;
const config: ProxyConfig = require(configFilePath);

console.log(`============================================`); // XXX
console.log(`Starting proxy server.`); // XXX
console.log(`Config path: ${configPath}`); // XXX
console.log(`HTTP port: ${config.httpPort}`); // XXX
console.log(`HTTPS port: ${config.httpsPort}`); // XXX
console.log(`Cert path: ${certPath}`); // XXX
console.log(`Cert key path: ${keyPath}`); // XXX
console.log(`CA path: ${process.env.NODE_EXTRA_CA_CERTS}`); // XXX
console.log(`Forwarding rules:`); // XXX

const proxy = redbird({
  port: config.httpPort,
  //xfwd: false,
  //secure: false,
  ssl: {
    // http2 was causing issues with https - https://github.com/OptimalBits/redbird/issues/231
    //http2: true,
    port: config.httpsPort,
    cert: certPath,
    key: keyPath
  }
});

for (const domain in config.forward) {
  console.log(`https://${domain} -> ${config.forward[domain]}`); // XXX
  proxy.register(domain, config.forward[domain], {useTargetHostHeader: true});
}
