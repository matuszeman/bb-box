const {Dic, DicLoader} = require('@kapitchi/bb-dic/es5');

const dic = new Dic();
const loader = new DicLoader({
  rootDir: __dirname + '/../services',
  //debug: true
});
loader.loadPath(dic, ['**/*.js', '!**/*.spec.js']);

module.exports = {
  dic
};
