import * as inquirer from 'inquirer';
import {Bbox, Ctx, Module, Service} from './bbox';
import { Cli } from './cli';

inquirer.registerPrompt(
  'command',
  require('inquirer-command-prompt')
)

export class Shell {
  private module: Module;
  private service: Service;
  private autocompletion = [];
  private prefix;

  constructor(private bbox: Bbox, private cli: Cli, private ctx: Ctx) {
  }

  async start() {
    const modules = this.bbox.getAllModules();

    const autoCompletionModules = [];
    for (const module of modules) {
      if (module.cwdAbsolutePath === process.cwd()) {
        this.module = module;
        this.service = Object.values(module.services)[0]
      }

      //autoCompletionModules.push(module.name);

      for (const serviceKey in module.services) {
        const service = module.services[serviceKey];
        autoCompletionModules.push(service.name);
      }
    }

    //this.autocompletion.push(...autoCompletionModules);

    this.autocompletion.push('cd', 'start', 'init', 'configure');
    while(true) {
      const ret = await inquirer.prompt([
        {
          type: 'command',
          name: 'cmd',
          prefix: `${this.service.name}`,
          message: '$',
          autoCompletion: (line: string) => {
            if (line.startsWith('cd')) {
              return autoCompletionModules.map((name) => `cd ${name}`);
            }
            return this.autocompletion;
          },
          autocompletePrompt: ' ',
          context: 0,
          short: true
        }
      ]);

      try {
        if (ret.cmd.startsWith('cd ')) {
          const serviceName = ret.cmd.split(' ')[1];
          this.service = this.bbox.getService(serviceName);
          continue;
        }

        await this.cli.runServiceCmd(this.service.name, ret.cmd);
      } catch (e) {
        console.error(e); // XXX
      }
    }
  }
}
