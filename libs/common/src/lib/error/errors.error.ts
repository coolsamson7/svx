
export class FatalError extends Error {
  // constructor

  constructor(message: string, cause?: Error) {
    super(message, { cause: cause });

    if (cause?.stack) this.stack = cause.stack;
  }
}

export class CommunicationError extends FatalError {
  // constructor

  constructor(message : string, cause?: Error) {
    super(message, cause);
  }
}
export class ServerError extends FatalError {
  // constructor

  constructor(
    public clazz: string,
    message: string,
    cause?: Error,
  ) {
    super(message, cause);
  }
}

