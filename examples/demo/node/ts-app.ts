console.log('Process env vars:', process.env);

let counter = 0;
console.log(++counter);
setInterval(() => {
  console.log('ts-app: ', ++counter);
}, 5000);
