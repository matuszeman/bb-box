import * as process from 'process';

process.on('message', function(message: any, sendHandle: any) {
  console.log(message); // XXX
  console.log('FFFFFFFFFFFFFFFFFFFF'); // XXX

  // process.send({
  //   type : 'process:msg',
  //   data : {
  //     success : true
  //   }
  // });
});

let counter = 0;
console.log(++counter); // XXX
setInterval(() => {
  console.log('ts-app: ', ++counter); // XXX
}, 5000);
