class DockerDiscovery {
    constructor(docker) {
        this.docker = docker;
    }
    
    getHost() {
        const modem = this.docker.modem;
        //docker toolbox - using virtual machine
        if (modem.host) {
            return {
                ip: modem.host
            };
        }
        
        //native host support
        return {
            ip: '127.0.0.1'
        };
    }
}

module.exports = DockerDiscovery;