"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process = require("process");
console.log('Process env vars:', process.env); // XXX
process.on('message', function (message, sendHandle) {
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
//# sourceMappingURL=ts-app.js.map