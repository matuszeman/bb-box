export declare enum ErrorCode {
    NotFound = "NotFound",
    NotImplemented = "NotImplemented"
}
export declare class BboxError extends Error {
    readonly code: ErrorCode;
    readonly previous: Error;
    constructor(code: ErrorCode, message: string, previousError?: Error);
    static catchHandler(code: ErrorCode, message: string): (err: any) => never;
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
    static of(e: Error, errorCode: ErrorCode): boolean;
    private createError;
}
