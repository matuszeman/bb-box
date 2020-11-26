"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shell = void 0;
const inquirer = require("inquirer");
inquirer.registerPrompt('command', require('inquirer-command-prompt'));
class Shell {
    constructor(bbox, cli, ctx) {
        this.bbox = bbox;
        this.cli = cli;
        this.ctx = ctx;
        this.autocompletion = [];
    }
    async start() {
        const modules = this.bbox.getAllModules();
        const autoCompletionModules = [];
        for (const module of modules) {
            if (module.cwdAbsolutePath === process.cwd()) {
                this.module = module;
                this.service = Object.values(module.services)[0];
            }
            //autoCompletionModules.push(module.name);
            for (const serviceKey in module.services) {
                const service = module.services[serviceKey];
                autoCompletionModules.push(service.name);
            }
        }
        //this.autocompletion.push(...autoCompletionModules);
        this.autocompletion.push('cd', 'start', 'init', 'configure');
        while (true) {
            const ret = await inquirer.prompt([
                {
                    type: 'command',
                    name: 'cmd',
                    prefix: `${this.service.name}`,
                    message: '$',
                    autoCompletion: (line) => {
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
            }
            catch (e) {
                console.error(e); // XXX
            }
        }
    }
}
exports.Shell = Shell;
//# sourceMappingURL=shell.js.map