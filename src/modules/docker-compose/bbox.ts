import * as fs from "fs";
import {RunnableFnParams, Runtime, ModuleSpec} from '../../bbox';
import * as YAML from 'yamljs';

const config: ModuleSpec = {
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
      dependencies: [{module: 'bbox-proxy', task: 'configure'}],
      prompt: {
        questions: [
          {type: 'input', name: 'dockerHostIp', message: 'Docker bridge gateway IP', env: 'dockerHostIp', default: '172.17.0.1'}
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
      dependencies: [{pipeline: 'configure'}]
    }
  }
}

async function bboxDockerComposeInfo(params: RunnableFnParams) {
  const Dockerode = require('dockerode');
  const dockerode = new Dockerode();
  const nets = await dockerode.listNetworks();
  for (const net of nets) {
    console.log(net.Name, net.IPAM?.Config);
  }
}

async function bboxDockerComposeGenerateFile(params: RunnableFnParams) {
  const {bbox, ctx} = params;

  const proxyState = bbox.getModule('bbox-proxy').state;
  const domain = proxyState.tasks.configure.prompt.domain;

  const dockerHostIp = process.env.dockerHostIp;

  const modules = bbox.getAllModules();

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

  const dockerComposePath = `${ctx.projectOpts.rootPath}/docker-compose.yml`;
  if (fs.existsSync(dockerComposePath)) {
    fs.unlinkSync(dockerComposePath);
  }

  const overwrite = {version: '3', services: {}};

  const extra_hosts = [];
  for (const service of proxiedServices) {
    //extra_hosts.push(`${service.name}:${service.ip}`);
    extra_hosts.push(`${service.domainName}:${service.ip}`);
  }

  const dockerComposeModules = modules.filter((module) => module.availableRuntimes.includes(Runtime.Docker));
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
      } else if (moduleSpec.docker?.file) {
        // TODO use project name instead of "bbox"
        dockerService.image = `bbox-${moduleSpec.name}`;
        // https://docs.docker.com/engine/reference/run/#specify-an-init-process
        // https://github.com/docker-library/php/issues/505#issuecomment-334274337
        dockerService.init = true;
        dockerService.build = {
          context: moduleFolderPath,
          dockerfile: moduleSpec.docker.file,
          // args: {
          //   USER_ID: '${USER_ID:-0}',
          //   GROUP_ID: '${GROUP_ID:-0}'
          // }
        };

        dockerService.working_dir = '/bbox';

        volumes.push(`${moduleFolderPath}:/bbox`);
      } else {
        throw new Error('Image nor file is configured for this docker module');
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

export default config;
