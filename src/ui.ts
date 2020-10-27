import * as inquirer from 'inquirer';
import {QuestionCollection} from 'inquirer';
import * as marked from 'marked';
import * as TerminalRenderer from 'marked-terminal';
import { cloneDeep } from 'lodash';

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

export class PromptParams<T> {
  questions: QuestionCollection<T>;
  initialAnswers?: Partial<T>;
}

export class Ui {

  constructor() {

  }

  print(markdown: string) {
    console.log(marked(markdown)); // XXX
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
