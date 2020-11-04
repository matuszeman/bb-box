import {ProxyConfig} from './proxy-server';
import * as fs from 'fs';
import {ModuleSpec, RunnableFnParams} from '../../bbox';

const config: ModuleSpec = {
  name: 'bbox-proxy',
  pipelines: {
    configure: {
      steps: {
        '10Configure': {
          task: 'configure'
        }
      }
    }
  },
  tasks: {
    configure: {
      run: async function bboxProxyConfigure(params: RunnableFnParams) {
        const {bbox} = params;

        const proxyService = await bbox.getService('bbox-proxy');
        const domain = process.env.domain;
        const hostIp = process.env.hostIp ?? '127.0.0.1';

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

        const proxyConfig: ProxyConfig = {
          httpPort: proxyService.spec.subServices['http'].port,
          httpsPort: proxyService.spec.subServices['https'].port,
          forward
        }
        fs.writeFileSync(`${proxyService.module.bboxPath}/proxy-config.json`, JSON.stringify(proxyConfig, null, 2));
      },
      prompt: {
        questions: [
          {type: 'input', name: 'hostIp', message: 'Host IP', env: 'hostIp', default: '127.0.0.1'},
          {type: 'input', name: 'domain', message: 'Domain', env: 'domain', default: '127.0.0.1.xip.io'},
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
      dependencies: [{task: 'configure'}]
    }
  }
}

export default config;
