"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BboxError = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NotFound"] = "NotFound";
    ErrorCode["NotImplemented"] = "NotImplemented";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
class BboxError extends Error {
    constructor(code, message, previousError) {
        super(message);
        //constructor(code: ServiceErrorCode, message: string, previous: Error)
        const err = this.createError(previousError);
        if (err) {
            this.previous = err;
        }
        this.name = code;
        this.code = code;
    }
    static catchHandler(code, message) {
        return (err) => {
            throw new BboxError(code, message, err);
        };
    }
    /**
     * Checks if ServiceError is thrown from a service specified with generic service error code.
     *
     * @example
     * const e = new ServiceError(ServiceErrorCode.AuthSamlServiceInvalidSomething);
     * ServiceError.of(e, ServiceErrorCode.AuthSamlService) === true
     *
     * const e = new ServiceError(ServiceErrorCode.AuthGoogleService);
     * ServiceError.of(e, ServiceErrorCode.AuthSamlService) === false
     */
    static of(e, errorCode) {
        return e.name.indexOf(errorCode) === 0;
    }
    // private createContext(context: {[key: string]: any} | ExecutionCtx) {
    //   if (context instanceof ExecutionCtx) {
    //     return context.getMeta();
    //   }
    //
    //   return context;
    // }
    createError(err) {
        if (err instanceof Error) {
            return err;
        }
        //handle "string" errors and convert them to Error
        if (typeof err === 'string') {
            return new Error(err);
        }
        return null;
    }
}
exports.BboxError = BboxError;
//# sourceMappingURL=errors.js.map