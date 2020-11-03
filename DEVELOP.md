

# Git support

For `nodegit`

```
sudo apt install libssl-dev
```

# Ideas

## Docker
Don't use docker-compose but dockernode

Docker host IP auto detection
https://stackoverflow.com/questions/48546124/what-is-linux-equivalent-of-host-docker-internal
https://github.com/qoomon/docker-host

## CLI
https://github.com/f/omelette
https://github.com/enquirer/enquirer#-custom-prompts

PTY support with control sequences
https://www.npmjs.com/package/node-pty

Shell
https://github.com/vercel/hyper

React for CLI
https://github.com/vadimdemedes/ink

## Models
dependency graph
https://www.npmjs.com/package/dependency-graph

## Reverse proxy
[done] https://github.com/OptimalBits/redbird

### Reverse proxy on port 80/443

Reference: https://pm2.keymetrics.io/docs/usage/specifics/#listening-on-port-80-wo-root

```
authbind --deep bbox start bbox-proxy
```
