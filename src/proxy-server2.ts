import * as process from 'process';
import * as http from 'http';
import * as Server from 'http-proxy';
import {ServerResponse} from 'http';

export interface ProxyConfig {
  forward: {[key: string]: string};
}

const config: ProxyConfig = JSON.parse(process.env.config);

export class ProxyServer {
  private proxy: Server;
  private server: http.Server;

  constructor() {
    const proxy = Server.createProxyServer({ws: true});
    this.proxy = proxy;

    this.server = http.createServer((req, res) => {
      const host = req.headers.host;
      if (!config.forward[host]) {
        return this.error(res, 503, 'No forward domain');
      }
      const target = `http://${config.forward[host]}`;
      console.log(`Proxying: ${host} -> ${target}`); // XXX
      proxy.web(req, res, {
        target
      });
    });
    this.server.on('error', (err) => {
      console.error(err);
      process.exit(1);
    });
    proxy.on('error', (err) => {
      console.error('proxy.web error: ', err); // XXX
    });
  }

  error(res: ServerResponse, code: number, message: string) {
    res.writeHead(code, { 'Content-Type': 'text/plain' });
    res.write(message);
    res.end();
  }

  start() {
    this.server.listen(80);
    this.server.listen(443);
  }
}

const server = new ProxyServer();
server.start();
