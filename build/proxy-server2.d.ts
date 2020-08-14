/// <reference types="node" />
import { ServerResponse } from 'http';
export interface ProxyConfig {
    forward: {
        [key: string]: string;
    };
}
export declare class ProxyServer {
    private proxy;
    private server;
    constructor();
    error(res: ServerResponse, code: number, message: string): void;
    start(): void;
}
