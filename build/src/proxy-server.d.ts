/// <reference types="node" />
import { ServerResponse } from 'http';
export declare class ProxyServer {
    private proxy;
    private server;
    constructor();
    error(res: ServerResponse, code: number, message: string): void;
    start(): void;
}
