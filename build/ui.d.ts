/// <reference types="node" />
import { QuestionCollection } from 'inquirer';
import WritableStream = NodeJS.WritableStream;
import { Writable } from 'stream';
import ReadableStream = NodeJS.ReadableStream;
export declare class PromptParams<T> {
    questions: QuestionCollection<T>;
    initialAnswers?: Partial<T>;
}
export declare class NullWritable extends Writable {
    _write(_chunk: any, _encoding: string, callback: (error?: Error | null) => void): void;
    _writev(_chunks: Array<{
        chunk: any;
        encoding: string;
    }>, callback: (error?: Error | null) => void): void;
}
export declare class Ui {
    opts: {
        stdout?: WritableStream;
        stdin?: ReadableStream;
        stdoutStripAnsi?: boolean;
    };
    static nullWriteable: NodeJS.WritableStream;
    stdout: WritableStream;
    stdin: ReadableStream;
    constructor(opts?: {
        stdout?: WritableStream;
        stdin?: ReadableStream;
        stdoutStripAnsi?: boolean;
    });
    print(markdown: string): void;
    prompt<T>(params: PromptParams<T>): Promise<T>;
}
