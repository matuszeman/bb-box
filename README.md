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

## Install

Install services

```
bb-box install
```

Runs:

* `installDependencies`
* `install`
* `migrations`

## Update

Updates services

```
bb-box update
```

Runs:

* `updateDependencies` (if not defined, installDependencies)
* `install`
* `migrations`

## Start

Start services

```
bb-box start
```


## Stop

Stop services

```
bb-box stop
```

## Service status

Prints service status

```
bb-box status
```

