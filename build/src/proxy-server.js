"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyServer = void 0;
const http = require("http");
const Server = require("http-proxy");
const hostMap = {
    'other-site.127.0.0.1.xip.io:8080': 'localhost:3000'
};
class ProxyServer {
    constructor() {
        const proxy = Server.createProxyServer({ ws: true });
        this.proxy = proxy;
        this.server = http.createServer((req, res) => {
            const host = req.headers.host;
            if (!hostMap[host]) {
                return this.error(res, 503, 'No forward domain');
            }
            const target = `http://${hostMap[host]}`;
            console.log(`Proxying: ${host} -> ${target}`); // XXX
            proxy.web(req, res, {
                target
            });
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
        this.server.listen(8080);
    }
}
exports.ProxyServer = ProxyServer;
const server = new ProxyServer();
server.start();
//# sourceMappingURL=proxy-server.js.map