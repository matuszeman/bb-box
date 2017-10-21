# bb-box

__Multi service application development box__

WORK IN PROGRESS

Features:

* make development of multi service applications easier
* one command to install/update/start/stop all services/apps
* support for docker-compose

Runtimes:

* local - run services locally
* docker-compose - run services using docker-compose

# Installation

```
npm i -g @kapitchi/bb-box
```

# Usage

```
bb-box install
```

Initialize services, create config files.
`bb-box update` must be ran before starting the service for the first time.

```
bb-box update
```

Update services, run migrations

```
bb-box start
```

Start services

```
bb-box stop
```

Stop services

```
bb-box status
```

Prints service status
