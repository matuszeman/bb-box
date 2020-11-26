"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyModule = void 0;
class ProxyModule {
    constructor() {
    }
    async onInit(bbox, ctx) {
        this.bbox = bbox;
    }
    async onCliInit(bbox, cli, ctx) {
    }
    async beforeStart(bbox, ctx) {
    }
    async beforeStatus(bbox, ctx) {
    }
}
exports.ProxyModule = ProxyModule;
const proxyModule = new ProxyModule();
exports.default = proxyModule;
//# sourceMappingURL=bbox.module.js.map