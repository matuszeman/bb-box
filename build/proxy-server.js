"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redbird = require("redbird");
const config = require(process.env.configFilePath);
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
//# sourceMappingURL=proxy-server.js.map