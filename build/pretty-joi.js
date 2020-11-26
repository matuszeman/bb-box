"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrettyJoi = void 0;
/**
 * Joi validation message formatter
 *
 * Inspired by https://github.com/dialexa/relish/blob/master/index.js
 */
class PrettyJoi {
    static parseError(error) {
        const validation = error.details.map((i) => {
            let err = {
                key: i.context.key,
                path: i.path.join('.'),
                //message: this._opts.stripQuotes ? i.message.replace(/"/g, '') : i.message,
                message: i.message,
                type: i.type.split('.').shift(),
                constraint: i.type.split('.').pop(),
                label: undefined
            };
            // if label is different than key, provide label
            if (i.context.label !== err.key) {
                err.label = i.context.label;
            }
            // set custom message (if exists)
            // if (this._opts.messages.hasOwnProperty(err.path)) {
            //   err.message = this._opts.messages[err.path]
            // } else if (this._opts.messages.hasOwnProperty(err.key)) {
            //   err.message = this._opts.messages[err.key]
            // }
            return err;
        });
        const message = validation.map((item) => item.message).join(', ');
        return {
            message,
            validation
        };
    }
}
exports.PrettyJoi = PrettyJoi;
//# sourceMappingURL=pretty-joi.js.map