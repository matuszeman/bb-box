import { Command } from 'commander';
import { Bbox, Ctx } from './bbox';
export declare class Cli {
    private bbox;
    private ctx;
    readonly program: Command;
    constructor(bbox: Bbox, ctx: Ctx);
    addCommand(cmd: string, action: Function, paramsHandler: Function): void;
    runArgv(argv: string[]): Promise<void>;
    runServiceCmd(service: string, cmd: string): Promise<void>;
}
