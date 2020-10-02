import {Bbox, BboxModule, Cli, Ctx, Runtime, Module} from '../../bbox';
import {ProxyConfig} from './proxy-server';
import * as fs from 'fs';
import * as YAML from 'yamljs';

export class ProxyModule implements BboxModule {
  private bbox: Bbox;

  constructor() {

  }

  async onInit(bbox: Bbox, ctx: Ctx) {
    this.bbox = bbox;
  }

  async onCliInit(bbox: Bbox, cli: Cli, ctx: Ctx) {
    cli.command(`proxy:configure`).action(async () => {
      await this.configure(ctx);
    });
  }

  async beforeStart(bbox: Bbox, ctx: Ctx) {

  }

  async beforeStatus(bbox: Bbox, ctx: Ctx) {

  }

  async configure(ctx: Ctx) {
    const {service, module} = await this.bbox.getService('bbox-proxy', ctx);

    const domain = await this.bbox.provideValue('bbox.domain', ctx);
    const dockerHostIp = await this.bbox.provideValue('bbox.dockerHostIp', ctx);
    //const httpPort = await this.bbox.provideValue('bbox-proxy.httpPort', ctx);
    //const httpsPort = await this.bbox.provideValue('bbox-proxy.httpsPort', ctx);

    const modules = await this.bbox.getAllModules(ctx);

    const proxiedServices: {name: string, port?: number, domainName: string, ip: string}[] = [];
    for (const module of modules) {
      if (module.name === 'bbox-proxy') {
        continue;
      }

      for (const srv of Object.values(module.services)) {
        const service = srv.spec;
        if (service.port) {
          proxiedServices.push({name: service.name, port: service.port, domainName: `${service.name}.${domain}`, ip: dockerHostIp});
        }
        if (service.subServices) {
          for (const subServiceKey of Object.keys(service.subServices)) {
            const subService = service.subServices[subServiceKey];
            proxiedServices.push({
              name: `${service.name}-${subService.name}`, port: subService.port,
              domainName: `${subService.name}.${service.name}.${domain}`, ip: dockerHostIp
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
      httpPort: service.spec.subServices['http'].port,
      httpsPort: service.spec.subServices['https'].port,
      forward
    }
    fs.writeFileSync(`${module.bboxPath}/proxy-config.json`, JSON.stringify(proxyConfig, null, 2));

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

      const dockerService: any = {};

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

        dockerService.volumes = [`${moduleFolderPath}:/bbox`];
      }

      if (moduleSpec.docker?.volumes) {
        dockerService.volumes = dockerService.volumes ?? [];
        for (const volumeName in moduleSpec.docker.volumes) {
          const containerPath = moduleSpec.docker.volumes[volumeName];
          dockerService.volumes.push(`${moduleFolderPath}/.bbox/state/volumes/${volumeName}:${containerPath}`);
        }
      }

      if (moduleSpec.env) {
        dockerService.environment = moduleSpec.env;
        for (const envName of Object.keys(moduleSpec.env)) {
          const envValue = moduleSpec.env[envName];
          dockerService.environment[envName] = envValue;
        }
      }

      dockerService.extra_hosts = extra_hosts;

      overwrite.services[moduleSpec.name] = dockerService;
    }

    const yaml = YAML.stringify(overwrite, 4, 2);
    fs.writeFileSync(ctx.projectOpts.dockerComposePath, yaml);
  }
}

const proxyModule = new ProxyModule();
export default proxyModule;
