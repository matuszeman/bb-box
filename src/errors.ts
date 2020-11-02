export enum ErrorCode {
  NotFound = 'NotFound',
  NotImplemented = 'NotImplemented'
}

export class BboxError extends Error {
  readonly code: ErrorCode;
  readonly previous: Error;

  constructor(code: ErrorCode, message: string, previousError?: Error) {
    super(message);

    //constructor(code: ServiceErrorCode, message: string, previous: Error)
    const err = this.createError(previousError);
    if (err) {
      this.previous = err;
    }

    this.name = code;
    this.code = code;
  }

  static catchHandler(code: ErrorCode, message: string) {
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
  static of(e: Error, errorCode: ErrorCode) {
    return e.name.indexOf(errorCode) === 0;
  }

  // private createContext(context: {[key: string]: any} | ExecutionCtx) {
  //   if (context instanceof ExecutionCtx) {
  //     return context.getMeta();
  //   }
  //
  //   return context;
  // }

  private createError(err): Error {
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
