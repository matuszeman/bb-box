console.log('Process env vars:', process.env);

let counter = 0;
console.log(++counter); // XXX
setInterval(() => {
  console.log('js-app', ++counter); // XXX
}, 5000);
