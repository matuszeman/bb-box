import * as inquirer from 'inquirer';
import {Bbox, Ctx, Module} from './bbox';
import { Cli } from './cli';

inquirer.registerPrompt(
  'command',
  require('inquirer-command-prompt')
)

export class Shell {
  private module: Module;
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
      }

      autoCompletionModules.push(module.name);

      for (const serviceKey in module.services) {
        const service = module.services[serviceKey];
        //this.autocompletion.push(`cd ${service.name}`);
      }
    }

    //this.autocompletion.push(...autoCompletionModules);

    this.autocompletion.push('cd', 'start', 'init', 'configure');

    while(true) {
      const ret = await inquirer.prompt([
        {
          type: 'command',
          name: 'cmd',
          prefix: `${this.module.name}`,
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

      if (ret.cmd.startsWith('cd ')) {
        this.module = modules.find((module) => module.name === ret.cmd.split(' ')[1]);
        continue;
      }

      await this.cli.runCmd(ret.cmd);
    }
  }
}
