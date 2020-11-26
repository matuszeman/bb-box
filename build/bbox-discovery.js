"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BboxDiscovery = exports.DiscoveryCtx = void 0;
const fs = require("fs");
const nodePath = require("path");
const globby = require("globby");
const bbox_1 = require("./bbox");
const errors_1 = require("./errors");
class DiscoveryCtx {
    constructor() {
        this.modules = [];
        this.depsToResolve = [];
    }
    resolveDependencies() {
        for (const dep of this.depsToResolve) {
            const { spec, dependant } = dep;
            if (!spec.module && !spec.service) {
                // default to dependant/this module if module is not set explicitly
                spec.module = dependant.module.name;
            }
            if (spec.service) {
                const service = this.getService(spec.service);
                dependant.dependencies.push({
                    origin: dependant,
                    target: service,
                    spec
                });
                continue;
            }
            if (spec.task) {
                const task = this.getTask(spec.module, spec.task);
                dependant.dependencies.push({
                    origin: dependant,
                    target: task,
                    spec
                });
                continue;
            }
            if (spec.pipeline) {
                const task = this.getPipeline(spec.module, spec.pipeline);
                dependant.dependencies.push({
                    origin: dependant,
                    target: task,
                    spec
                });
                continue;
            }
        }
    }
    getService(name) {
        for (const module of this.modules) {
            if (module.services[name]) {
                return module.services[name];
            }
        }
        throw new errors_1.BboxError(errors_1.ErrorCode.NotFound, `Service ${name} not found`);
    }
    getTask(module, name) {
        const ret = this.getModule(module).tasks[name];
        if (ret) {
            return ret;
        }
        throw new errors_1.BboxError(errors_1.ErrorCode.NotFound, `Task ${name} not found`);
    }
    getPipeline(module, name) {
        const ret = this.getModule(module).pipelines[name];
        if (ret) {
            return ret;
        }
        throw new errors_1.BboxError(errors_1.ErrorCode.NotFound, `Pipeline ${name} not found`);
    }
    getModule(name) {
        for (const module of this.modules) {
            if (module.name === name) {
                return module;
            }
        }
        throw new errors_1.BboxError(errors_1.ErrorCode.NotFound, `Module ${name} not found`);
    }
}
exports.DiscoveryCtx = DiscoveryCtx;
class BboxDiscovery {
    constructor() {
        this.bboxFile = 'bbox.js';
        this.bboxFilesGlob = [
            this.bboxFile,
            `*/${this.bboxFile}`
        ];
    }
    discoverRootPath(currentPath) {
        let rootPath = undefined;
        while (true) {
            if (fs.existsSync(`${currentPath}/${this.bboxFile}`)) {
                rootPath = currentPath;
            }
            const parentPath = nodePath.dirname(currentPath);
            if (parentPath === currentPath) {
                break;
            }
            currentPath = parentPath;
        }
        if (!rootPath) {
            throw new Error(`Could not find root ${this.bboxFile} file`);
        }
        return rootPath;
    }
    async discoverModules(rootPath) {
        const paths = globby.sync(this.bboxFilesGlob, {
            ignore: ['**/.bbox'],
            cwd: rootPath,
            absolute: true,
            gitignore: true,
            // TODO suppressErrors does not work and still getting EACCESS errors
            suppressErrors: true // to suppress e.g. EACCES: permission denied, scandir
        });
        const ctx = new DiscoveryCtx();
        for (const moduleFilePath of paths) {
            try {
                const absolutePath = nodePath.dirname(moduleFilePath);
                const moduleSpec = require(moduleFilePath);
                const module = this.createModule(rootPath, absolutePath, moduleSpec, `${absolutePath}/.bbox`, absolutePath, ctx);
                ctx.modules.push(module);
            }
            catch (e) {
                throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
            }
        }
        ctx.resolveDependencies();
        return ctx.modules;
    }
    async discoverInternalModules(projectRootPath) {
        const rootPath = `${__dirname}/modules`;
        const paths = globby.sync(this.bboxFilesGlob, {
            ignore: ['**/.bbox'],
            cwd: rootPath,
            absolute: true,
            gitignore: true,
            // TODO suppressErrors does not work and still getting EACCESS errors
            suppressErrors: true // to suppress e.g. EACCES: permission denied, scandir
        });
        const ctx = new DiscoveryCtx();
        for (const moduleFilePath of paths) {
            try {
                const absolutePath = nodePath.dirname(moduleFilePath);
                const moduleSpec = this.loadJsFile(moduleFilePath);
                const bboxPath = `${projectRootPath}/.bbox/internal-modules/${moduleSpec.name}`;
                const module = this.createModule(rootPath, absolutePath, moduleSpec, bboxPath, bboxPath, ctx);
                ctx.modules.push(module);
            }
            catch (e) {
                throw new Error(`Module file error. Module disabled. ${moduleFilePath}: ${e}\n${e.stack}`);
            }
        }
        ctx.resolveDependencies();
        return ctx.modules;
    }
    saveModuleState(module) {
        fs.writeFileSync(`${module.bboxPath}/state.json`, JSON.stringify(module.state, null, 2));
    }
    createModule(rootPath, absolutePath, moduleSpec, bboxPath, cwdPath, ctx) {
        this.mkdir(bboxPath);
        const stateFilePath = `${bboxPath}/state.json`;
        this.mkfile(stateFilePath, '{}');
        const bboxModuleFile = `${absolutePath}/bbox.module.js`;
        const bboxModule = this.loadJsFileIfExists(bboxModuleFile);
        const statePath = `${bboxPath}/state`;
        this.mkdir(statePath);
        const path = absolutePath.replace(rootPath, '').slice(1);
        this.mkdir(`${statePath}/docker-volumes`);
        const relDockerVolumesPath = `${path}/.bbox/state/docker-volumes`;
        const moduleStateFile = this.loadJsFile(stateFilePath);
        // TODO types
        const state = Object.assign({
            tasks: {},
            pipelines: {}
        }, moduleStateFile);
        const module = {
            type: 'Module',
            root: rootPath === absolutePath,
            cwdAbsolutePath: cwdPath,
            name: moduleSpec.name,
            services: {},
            state,
            runtime: moduleSpec.runtime,
            absolutePath,
            path,
            availableRuntimes: [],
            spec: moduleSpec,
            bboxPath: bboxPath,
            bboxModule,
            tasks: {},
            pipelines: {}
        };
        module.tasks = this.createTasks(moduleSpec.tasks, module, ctx);
        module.pipelines = this.createPipelines(moduleSpec.pipelines, module, ctx);
        if (moduleSpec.docker) {
            module.availableRuntimes.push(bbox_1.Runtime.Docker);
            const volumes = this.mkdirDockerVolumes(moduleSpec.docker.volumes, relDockerVolumesPath, path);
            module.docker = {
                volumes
            };
        }
        // Services
        if (moduleSpec.services) {
            for (const serviceName of Object.keys(moduleSpec.services)) {
                const serviceSpec = moduleSpec.services[serviceName];
                if (!serviceSpec.name) {
                    serviceSpec.name = serviceName;
                }
                if (!serviceSpec.env) {
                    serviceSpec.env = {};
                }
                if (serviceSpec.start && !module.availableRuntimes.includes(bbox_1.Runtime.Local)) {
                    module.availableRuntimes.push(bbox_1.Runtime.Local);
                }
                const service = {
                    type: 'Service',
                    module,
                    name: serviceSpec.name,
                    spec: serviceSpec,
                    state: {
                        processStatus: bbox_1.ServiceProcessStatus.Unknown
                    },
                    dependencies: []
                };
                // resolve dependencies
                this.discoverDependencies(serviceSpec.dependencies, service, ctx);
                if (serviceSpec.docker) {
                    // make sure to pre-create docker volumes otherwise they'll be create with root permissions by docker-compose
                    const volumes = this.mkdirDockerVolumes(serviceSpec.docker.volumes, relDockerVolumesPath, path);
                    service.docker = {
                        volumes
                    };
                }
                module.services[serviceName] = service;
            }
        }
        if (module.availableRuntimes.length === 0) {
            module.availableRuntimes.push(bbox_1.Runtime.Local);
            //throw new Error(`Module ${module.name} has no available runtime`);
            //console.warn(`Module ${module.spec.name} has no available runtime`);
        }
        if (!module.runtime) {
            module.runtime = module.availableRuntimes[0];
        }
        return module;
    }
    createTasks(tasksSpec, module, ctx) {
        if (!tasksSpec) {
            return {};
        }
        const tasks = {};
        for (const name of Object.keys(tasksSpec)) {
            const taskSpec = tasksSpec[name];
            const task = {
                type: 'Task',
                name,
                module,
                spec: taskSpec,
                dependencies: []
            };
            this.discoverDependencies(taskSpec.dependencies, task, ctx);
            tasks[name] = task;
        }
        return tasks;
    }
    createPipelines(pipelinesSpec, module, ctx) {
        if (!pipelinesSpec) {
            return {};
        }
        const pipelines = {};
        for (const name of Object.keys(pipelinesSpec)) {
            const spec = pipelinesSpec[name];
            const pipeline = {
                type: 'Pipeline',
                name,
                module,
                spec,
                dependencies: []
            };
            this.discoverDependencies(spec.dependencies, pipeline, ctx);
            pipelines[name] = pipeline;
        }
        return pipelines;
    }
    discoverDependencies(dependenciesSpec, dependant, ctx) {
        if (!dependenciesSpec) {
            return;
        }
        for (const dependencySpecOrig of dependenciesSpec) {
            const dependencySpec = {
                //module: dependant.dependantModule?.name,
                //service: dependant.dependantService?.name,
                ...dependencySpecOrig
            };
            ctx.depsToResolve.push({
                dependant,
                spec: dependencySpec
            });
        }
    }
    loadJsFileIfExists(path) {
        if (fs.existsSync(path)) {
            return this.loadJsFile(path);
        }
        return undefined;
    }
    loadJsFile(path) {
        let file = require(path);
        // ts: export default {}
        if (file.default) {
            file = file.default;
        }
        return file;
    }
    mkdir(path) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
    }
    /**
     * Make sure to pre-create docker volumes otherwise they'll be create with root permissions by docker-compose
     */
    mkdirDockerVolumes(volumesSpec, volumesStatePath, relModulePath) {
        if (!volumesSpec) {
            return {};
        }
        const oldUmask = process.umask(0);
        const volumes = {};
        for (const volumeName in volumesSpec) {
            let volumeSpec = volumesSpec[volumeName];
            let hostPath = `${volumesStatePath}/${volumeName}`;
            let containerPath;
            if (typeof volumeSpec === 'string') {
                containerPath = volumeSpec;
            }
            else {
                ({ containerPath, hostPath } = volumeSpec);
                hostPath = `${relModulePath}/${hostPath}`;
            }
            volumes[volumeName] = {
                containerPath,
                hostPath: `./${hostPath}` // must be prefixed with ./ otherwise it's taken as named volume
            };
            this.mkdir(hostPath);
        }
        process.umask(oldUmask);
        return volumes;
    }
    mkfile(path, content) {
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, content);
        }
    }
}
exports.BboxDiscovery = BboxDiscovery;
//# sourceMappingURL=bbox-discovery.js.map