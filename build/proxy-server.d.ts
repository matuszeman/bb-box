export interface ProxyConfig {
    port: number;
    forward: {
        [key: string]: string;
    };
}
