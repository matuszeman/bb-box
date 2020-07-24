/**
 * Joi validation message formatter
 *
 * Inspired by https://github.com/dialexa/relish/blob/master/index.js
 */
export declare class PrettyJoi {
    static parseError(error: any): {
        message: any;
        validation: any;
    };
}
