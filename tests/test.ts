import * as process from 'process';
import {Bbox, BboxDiscovery, ProcessManager, RunnableFnParams, Runner} from '../src/bbox';

const path = process.cwd() + '/examples/all-features';
console.log(path); // XXX
const discovery = new FileManager();
const modules = discovery.discoverModules(path);
const bbox = new Bbox({cwd: path}, discovery, new Runner(), new ProcessManager());
(async () => {
  const ret = await bbox.runRestartApp(modules[1], 'node-single-app', {});
  console.log(modules[1]); // XXX
})();
