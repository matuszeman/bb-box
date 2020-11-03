import * as inquirer from 'inquirer';
import {QuestionCollection} from 'inquirer';
import * as marked from 'marked';
import * as TerminalRenderer from 'marked-terminal';
import { cloneDeep } from 'lodash';
import WritableStream = NodeJS.WritableStream;
import {PassThrough, Transform, Writable} from 'stream';
import ReadableStream = NodeJS.ReadableStream;
import * as stripAnsiStream from 'strip-ansi-stream';

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

export class PromptParams<T> {
  questions: QuestionCollection<T>;
  initialAnswers?: Partial<T>;
}

export class NullWritable extends Writable {
  _write(_chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    callback()
  }
  _writev(_chunks: Array<{chunk: any; encoding: string}>, callback: (error?: Error | null) => void): void {
    callback()
  }
}

export class Ui {
  static nullWriteable: NodeJS.WritableStream = new NullWritable();

  stdout: WritableStream;
  stdin: ReadableStream;

  constructor(public opts: {stdout?: WritableStream, stdin?: ReadableStream, stdoutStripAnsi?: boolean} = {}) {
    const passthrough = new PassThrough();
    passthrough.on('data', (data) => {
      console.log('>>>', data); // XXX
      console.log('>>>', data); // XXX
    });

    this.stdout = passthrough.pipe(opts.stdout ?? process.stdout);
    this.stdin = opts.stdin ?? process.stdin;

    if (opts.stdoutStripAnsi) {
      console.log('RRRRRRRRRRRRRR'); // XXX
      console.log('RRRRRRRRRRRRRR'); // XXX

      this.stdout = stripAnsiStream().pipe(passthrough).pipe(this.stdout);
    }
  }

  print(markdown: string) {
    this.stdout.write(marked(markdown)); // XXX
  }

  async prompt<T>(params: PromptParams<T>) {
    const questions = cloneDeep(params.questions) as ReadonlyArray<any>;
    questions.forEach((question) => {
      if (params.initialAnswers && params.initialAnswers[question.name]) {
        question.default = params.initialAnswers[question.name];
      }
    });
    return inquirer.prompt<T>(questions);
  }
}
