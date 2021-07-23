"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ui = exports.NullWritable = exports.PromptParams = void 0;
const inquirer = require("inquirer");
const marked = require("marked");
const TerminalRenderer = require("marked-terminal");
const lodash_1 = require("lodash");
const stream_1 = require("stream");
const stripAnsiStream = require("strip-ansi-stream");
marked.setOptions({
    renderer: new TerminalRenderer()
});
class PromptParams {
}
exports.PromptParams = PromptParams;
class NullWritable extends stream_1.Writable {
    _write(_chunk, _encoding, callback) {
        callback();
    }
    _writev(_chunks, callback) {
        callback();
    }
}
exports.NullWritable = NullWritable;
class Ui {
    constructor(opts = {}) {
        var _a, _b;
        this.opts = opts;
        // TODO
        const passthrough = new stream_1.PassThrough();
        passthrough.on('data', (data) => {
            // console.log('>>>', data); // XXX
            // console.log('>>>', data); // XXX
        });
        this.stdout = passthrough.pipe((_a = opts.stdout) !== null && _a !== void 0 ? _a : process.stdout);
        this.stdin = (_b = opts.stdin) !== null && _b !== void 0 ? _b : process.stdin;
        if (opts.stdoutStripAnsi) {
            this.stdout = stripAnsiStream().pipe(passthrough).pipe(this.stdout);
        }
    }
    print(markdown) {
        this.stdout.write(marked(markdown));
    }
    async prompt(params) {
        const questions = lodash_1.cloneDeep(params.questions);
        questions.forEach((question) => {
            if (params.initialAnswers && params.initialAnswers[question.name]) {
                question.default = params.initialAnswers[question.name];
            }
        });
        return inquirer.prompt(questions);
    }
}
exports.Ui = Ui;
Ui.nullWriteable = new NullWritable();
//# sourceMappingURL=ui.js.map