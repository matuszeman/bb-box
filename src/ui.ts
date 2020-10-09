import * as inquirer from 'inquirer';
import {QuestionCollection} from 'inquirer';
import * as marked from 'marked';
import * as TerminalRenderer from 'marked-terminal';

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

export class Ui {

  constructor() {

  }

  print(markdown: string) {
    console.log(marked(markdown)); // XXX
  }

  async prompt<T>(questions: QuestionCollection<T>, initialAnswers?: Partial<T>) {
    return inquirer.prompt(questions, initialAnswers);
  }
}
