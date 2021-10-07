"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const bbox_1 = require("../../bbox");
const YAML = require("yamljs");
const config = {
    name: 'bbox-docker-compose',
    pipelines: {
        configure: {
            steps: {
                '10GenerateConfigFile': {
                    task: 'GenerateComposeFile'
                }
            }
        }
    },
    tasks: {
        GenerateComposeFile: {
            dependencies: [{ module: 'bbox-proxy', task: 'configure' }],
            prompt: {
                questions: [
                    { type: 'input', name: 'dockerHostIp', message: 'Docker bridge gateway IP', env: 'dockerHostIp', default: '172.17.0.1' }
                ]
            },
            run: bboxDockerComposeGenerateFile
        },
        listNetworks: {
            run: bboxDockerComposeInfo
        }
    },
    services: {
        'bbox-docker-compose': {
            dependencies: [{ pipeline: 'configure' }]
        }
    }
};
async function bboxDockerComposeInfo(params) {
    var _a;
    const Dockerode = require('dockerode');
    const dockerode = new Dockerode();
    const nets = await dockerode.listNetworks();
    for (const net of nets) {
        console.log(net.Name, (_a = net.IPAM) === null || _a === void 0 ? void 0 : _a.Config);
    }
}
async function bboxDockerComposeGenerateFile(params) {
    var _a, _b, _c, _d;
    const { bbox, ctx } = params;
    const proxyState = bbox.getModule('bbox-proxy').state;
    const domain = proxyState.tasks.configure.prompt.domain;
    const dockerHostIp = process.env.dockerHostIp;
    const modules = bbox.getAllModules();
    const proxiedServices = [];
    for (const module of modules) {
        if (module.name === 'bbox-proxy') {
            continue;
        }
        for (const srv of Object.values(module.services)) {
            const service = srv.spec;
            if (service.port) {
                proxiedServices.push({
                    name: service.name,
                    port: service.port,
                    domainName: `${service.name}.${domain}`,
                    ip: dockerHostIp
                });
            }
            if (service.subServices) {
                for (const subServiceKey of Object.keys(service.subServices)) {
                    const subService = service.subServices[subServiceKey];
                    proxiedServices.push({
                        name: `${service.name}-${subService.name}`, port: subService.port,
                        domainName: `${service.name}-${subService.name}.${domain}`, ip: dockerHostIp
                    });
                }
            }
        }
    }
    const dockerComposePath = `${ctx.projectOpts.rootPath}/docker-compose.yml`;
    if (fs.existsSync(dockerComposePath)) {
        fs.unlinkSync(dockerComposePath);
    }
    const overwrite = { version: '3', services: {} };
    const extra_hosts = [];
    for (const service of proxiedServices) {
        //extra_hosts.push(`${service.name}:${service.ip}`);
        extra_hosts.push(`${service.domainName}:${service.ip}`);
    }
    const dockerComposeModules = modules.filter((module) => module.availableRuntimes.includes(bbox_1.Runtime.Docker));
    for (const mod of dockerComposeModules) {
        const moduleSpec = mod.spec;
        const moduleFolderPath = `./${mod.path}`;
        for (const serviceName in mod.services) {
            const service = mod.services[serviceName];
            const serviceSpec = service.spec;
            const dockerService = {};
            const volumes = [];
            // module config
            if ((_a = moduleSpec.docker) === null || _a === void 0 ? void 0 : _a.image) {
                dockerService.image = moduleSpec.docker.image;
            }
            else if ((_b = moduleSpec.docker) === null || _b === void 0 ? void 0 : _b.file) {
                // TODO use project name instead of "bbox"
                dockerService.image = `bbox-${moduleSpec.name}`;
                // https://docs.docker.com/engine/reference/run/#specify-an-init-process
                // https://github.com/docker-library/php/issues/505#issuecomment-334274337
                dockerService.init = true;
                dockerService.build = {
                    context: moduleFolderPath,
                    dockerfile: moduleSpec.docker.file,
                };
                dockerService.working_dir = '/bbox';
                volumes.push(`${moduleFolderPath}:/bbox`);
            }
            else {
                throw new Error('Image nor file is configured for this docker module');
            }
            if ((_c = mod.docker) === null || _c === void 0 ? void 0 : _c.volumes) {
                for (const volumeName in mod.docker.volumes) {
                    const volume = mod.docker.volumes[volumeName];
                    volumes.push(`${volume.hostPath}:${volume.containerPath}`);
                }
            }
            // service config
            if ((_d = service.docker) === null || _d === void 0 ? void 0 : _d.volumes) {
                for (const volumeName in service.docker.volumes) {
                    const volume = service.docker.volumes[volumeName];
                    volumes.push(`${volume.hostPath}:${volume.containerPath}`);
                }
            }
            if (moduleSpec.env) {
                dockerService.environment = moduleSpec.env;
                for (const envName of Object.keys(moduleSpec.env)) {
                    const envValue = moduleSpec.env[envName];
                    dockerService.environment[envName] = envValue;
                }
            }
            // TODO do we want to generate this?
            if (service.spec.start) {
                dockerService.command = service.spec.start;
            }
            dockerService.volumes = volumes;
            dockerService.extra_hosts = extra_hosts;
            overwrite.services[serviceSpec.name] = dockerService;
        }
    }
    const yaml = YAML.stringify(overwrite, 4, 2);
    fs.writeFileSync(ctx.projectOpts.dockerComposePath, yaml);
}
exports.default = config;
//# sourceMappingURL=bbox.js.map