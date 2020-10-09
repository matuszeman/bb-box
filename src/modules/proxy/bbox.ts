import {ProxyConfig} from './proxy-server';
import * as fs from "fs";
import {RunnableFnParams, Runtime} from '../../bbox';
import * as YAML from 'yamljs';

export default {
  name: 'bbox-proxy',
  configure: {
    run: [
      async (params: RunnableFnParams) => {
        const {bbox, ctx} = params;
        const proxyService = await bbox.getService('bbox-proxy');

        const domain = await bbox.provideValue('bbox.domain', ctx);
        const dockerHostIp = await bbox.provideValue('bbox.dockerHostIp', ctx);
        //const httpPort = await bbox.provideValue('bbox-proxy.httpPort', ctx);
        //const httpsPort = await bbox.provideValue('bbox-proxy.httpsPort', ctx);

        const modules = await bbox.getAllModules();

        const proxiedServices: { name: string, port?: number, domainName: string, ip: string }[] = [];
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

        const forward = {};
        for (const proxiedService of proxiedServices) {
          if (proxiedService.port) {
            const destination = `http://127.0.0.1:${proxiedService.port}`;
            forward[proxiedService.domainName] = destination;
            //forward[proxyService.name] = destination;
          }
        }

        const proxyConfig: ProxyConfig = {
          httpPort: proxyService.spec.subServices['http'].port,
          httpsPort: proxyService.spec.subServices['https'].port,
          forward
        }
        fs.writeFileSync(`${proxyService.module.bboxPath}/proxy-config.json`, JSON.stringify(proxyConfig, null, 2));

        // docker
        if (fs.existsSync(ctx.projectOpts.dockerComposePath)) {
          fs.unlinkSync(ctx.projectOpts.dockerComposePath);
        }

        const overwrite = {version: '3', services: {}};

        const dockerComposeModules = modules.filter((module) => module.availableRuntimes.includes(Runtime.Docker));

        const extra_hosts = [];
        for (const service of proxiedServices) {
          //extra_hosts.push(`${service.name}:${service.ip}`);
          extra_hosts.push(`${service.domainName}:${service.ip}`);
        }
        for (const mod of dockerComposeModules) {
          const moduleSpec = mod.spec;
          const moduleFolderPath = `./${mod.path}`;

          for (const serviceName in mod.services) {
            const service = mod.services[serviceName];
            const serviceSpec = service.spec;

            const dockerService: any = {};
            const volumes = [];

            // module config
            if (moduleSpec.docker?.image) {
              dockerService.image = moduleSpec.docker.image;
            }

            if (moduleSpec.docker?.file) {
              // TODO use project name instead of "bbox"
              dockerService.image = `bbox-${moduleSpec.name}`;
              dockerService.build = {
                context: moduleFolderPath,
                dockerfile: moduleSpec.docker.file
              };

              dockerService.working_dir = '/bbox';

              volumes.push(`${moduleFolderPath}:/bbox`);
            }

            if (mod.docker?.volumes) {
              for (const volumeName in mod.docker.volumes) {
                const volume = mod.docker.volumes[volumeName];
                volumes.push(`${volume.hostPath}:${volume.containerPath}`);
              }
            }

            // service config
            if (service.docker?.volumes) {
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

            dockerService.volumes = volumes;
            dockerService.extra_hosts = extra_hosts;

            overwrite.services[serviceSpec.name] = dockerService;
          }
        }

        const yaml = YAML.stringify(overwrite, 4, 2);
        fs.writeFileSync(ctx.projectOpts.dockerComposePath, yaml);
      }
    ]
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
      start: 'node proxy-server.js'
    }
  }
}
