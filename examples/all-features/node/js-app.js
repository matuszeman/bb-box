let counter = 0;
console.log(++counter); // XXX
//console.log(require('./config.js')); // XXX
setInterval(() => {
  console.log('js-app', ++counter); // XXX
}, 5000);
