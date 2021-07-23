"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const moduleName = 'bbox-proxy';
const config = {
    name: moduleName,
    onModuleRegistered: async (params) => {
        for (const name in params.registeredModule.services) {
            const serviceSpec = params.registeredModule.services[name].spec;
            if (!serviceSpec.env) {
                serviceSpec.env = {};
            }
            serviceSpec.env.BBOX_PROXY_DOMAIN = async ({ getTaskReturnValue }) => {
                return getTaskReturnValue('configure', moduleName).domain;
            };
        }
    },
    pipelines: {
        configure: {
            steps: {
                '10Configure': {
                    task: 'configure'
                },
                '20CreateCertificate': {
                    task: 'CreateMkcert'
                }
            }
        }
    },
    tasks: {
        configure: {
            run: async function bboxProxyConfigure(params) {
                const { bbox } = params;
                const proxyService = await bbox.getService('bbox-proxy');
                const domain = process.env.domain;
                const hostIp = process.env.hostIp;
                const modules = bbox.getAllModules();
                const proxiedServices = [];
                for (const module of modules) {
                    if (module.name === moduleName) {
                        continue;
                    }
                    for (const srv of Object.values(module.services)) {
                        const service = srv.spec;
                        if (service.port) {
                            proxiedServices.push({
                                name: service.name,
                                port: service.port,
                                domainName: `${service.name}.${domain}`,
                                ip: hostIp
                            });
                        }
                        if (service.subServices) {
                            for (const subServiceKey of Object.keys(service.subServices)) {
                                const subService = service.subServices[subServiceKey];
                                proxiedServices.push({
                                    name: `${service.name}-${subService.name}`, port: subService.port,
                                    domainName: `${service.name}-${subService.name}.${domain}`, ip: hostIp
                                });
                            }
                        }
                    }
                }
                const forward = {};
                for (const proxiedService of proxiedServices) {
                    if (proxiedService.port) {
                        const destination = `http://${proxiedService.ip}:${proxiedService.port}`;
                        forward[proxiedService.domainName] = destination;
                    }
                }
                const proxyConfig = {
                    httpPort: proxyService.spec.subServices['http'].port,
                    httpsPort: proxyService.spec.subServices['https'].port,
                    forward
                };
                fs.writeFileSync(`${proxyService.module.bboxPath}/proxy-config.json`, JSON.stringify(proxyConfig, null, 2));
                return {
                    hostIp,
                    domain
                };
            },
            prompt: {
                questions: [
                    { type: 'input', name: 'hostIp', message: 'Host IP', env: 'hostIp', default: '127.0.0.1' },
                    { type: 'input', name: 'domain', message: 'Domain', env: 'domain', default: 'localhost' },
                ]
            }
        },
        CreateMkcert: {
            run: async ({ module, getTaskReturnValue, run, ctx }) => {
                if (!process.env.create) {
                    ctx.ui.print('Cancelled. Did not create new certificates.');
                    return;
                }
                const { domain } = getTaskReturnValue('configure');
                const { output: caPath } = await run('mkcert -CAROOT');
                const certKeyPath = `${process.cwd()}/state/cert.key`;
                const certCrtPath = `${process.cwd()}/state/cert.crt`;
                await run(`mkcert -key-file ${certKeyPath} -cert-file ${certCrtPath} ${domain} "*.${domain}"`);
                return {
                    caPath: `${caPath.trim()}/rootCA.pem`,
                    crtPath: certCrtPath,
                    keyPath: certKeyPath
                };
            },
            dependencies: [
                { task: 'configure' }
            ],
            prompt: {
                questions: [
                    { type: 'confirm', name: 'create', message: 'Should I create local certificate using mkcert?', env: 'create' },
                ]
            }
        }
    },
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
            start: 'node proxy-server.js',
            dependencies: [
                { task: 'configure' }
            ],
            env: {
                NODE_EXTRA_CA_CERTS: ({ getTaskReturnValue }) => {
                    return getTaskReturnValue('CreateMkcert').caPath;
                }
            }
        }
    }
};
exports.default = config;
//# sourceMappingURL=bbox.js.map