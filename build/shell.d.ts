import { Bbox, Ctx } from './bbox';
import { Cli } from './cli';
export declare class Shell {
    private bbox;
    private cli;
    private ctx;
    private module;
    private service;
    private autocompletion;
    private prefix;
    constructor(bbox: Bbox, cli: Cli, ctx: Ctx);
    start(): Promise<void>;
}
