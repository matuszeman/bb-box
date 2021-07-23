# bbox

Tool for setting up and running local multi-application development environment.  

What do you get from __bbox__?

* __Interactive setup of development environment.__
  Do not spend hours setting up your local development environment manually, just start services you're going to work and begin working. 
* __Reverse proxy with HTTPS support.__
  All applications are automatically available under their own domain name. No need to run nginx or maintain configuration manually.  
* __Support for both local and Docker runtimes.__
  No need to install application specific system dependencies on your machine, you can choose to use docker container runtime on selected applications.

## Installation

Prerequisites:

* [NodeJS](https://nodejs.org/en/) >= 7.6
* [PM2](https://pm2.keymetrics.io/) >= 4.2 - process manager

```
npm i -g matuszeman/bb-box
```

## Usage

__Module__ represents single build unit of the project.
It could be a backend or frontend app implementation or already containerized services like MySQL or MongoDB databases.

Module implements __tasks__. A task can either be a command to run (e.g. `npm i`) or implemented as javascript function.
Typical examples might be "install packages", "create config file", "run database migration", "reset database" and so on.
A task is executed in the context of its module, i.e. task process has current working directory and environment variables as set for this module.

__Pipeline__ represents as series of steps, each step executes a __task__.
Pipelines are great for defining how the module should be configured or build.
By default, when pipeline runs, it executes all steps regardless a task has run before.
Steps can be configured to run tasks only once, this way, any further pipeline runs skip this task.

__Service__ represents long-running process, which is started and managed by process manager. 
This could be for example API server, MongoDB database, message queue consumer, ...
Services talk to each other via a network loopback interface.
Each service binds to its own port number, which should be kept unique per project.

It's possible to specify __dependencies__ for any service, pipeline or task.
Dependency can be either running service, executed pipeline or task. 

### Project setup

__Project folder hierarchy example__

* `demo-project` - PROJECT
  * `bbox.js` - project bbox file
  * `backend` - MODULE - 
    * `api` - API service implementation
      
    * `bbox.js`
  * `mongo` - MODULE - docker module
    * `bbox.js` - app2 bbox file
    
Go to [examples](examples/demo) to see how to setup a project including NodeJS, PHP apps and MongoDB database.

### CLI commands
To see all available `bbox` commands
```
bbox -h
```

Start application
```
bbox start myapp
```

Stop application
```
bbox stop myapp
```
