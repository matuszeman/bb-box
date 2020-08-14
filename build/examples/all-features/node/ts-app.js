"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process = require("process");
process.on('message', function (packet) {
    console.log(packet); // XXX
    process.send({
        type: 'process:msg',
        data: {
            success: true
        }
    });
});
let counter = 0;
console.log(++counter); // XXX
setInterval(() => {
    console.log('ts-app: ', ++counter); // XXX
}, 5000);
//# sourceMappingURL=ts-app.js.map