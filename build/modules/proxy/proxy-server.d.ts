export interface ProxyConfig {
    httpPort: number;
    httpsPort: number;
    forward: {
        [key: string]: string;
    };
}
