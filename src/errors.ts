export class BaseError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export class InvaildParamError extends BaseError {
  constructor(msg: string) {
    super(msg);
  }
}

export class InvaildSettingError extends BaseError {
  constructor(msg: string) {
    super(msg);
  }
}
