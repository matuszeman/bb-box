let counter = 0;
console.log(++counter); // XXX
setInterval(() => {
  console.log('ts-app: ', ++counter); // XXX
}, 5000);
