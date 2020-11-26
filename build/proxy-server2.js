"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyServer = void 0;
const process = require("process");
const http = require("http");
const Server = require("http-proxy");
const config = JSON.parse(process.env.config);
class ProxyServer {
    constructor() {
        const proxy = Server.createProxyServer({ ws: true });
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
    error(res, code, message) {
        res.writeHead(code, { 'Content-Type': 'text/plain' });
        res.write(message);
        res.end();
    }
    start() {
        this.server.listen(80);
        this.server.listen(443);
    }
}
exports.ProxyServer = ProxyServer;
const server = new ProxyServer();
server.start();
//# sourceMappingURL=proxy-server2.js.map