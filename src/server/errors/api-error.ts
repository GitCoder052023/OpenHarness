export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message);
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message);
  }

  static serviceUnavailable(message = "Service unavailable"): ApiError {
    return new ApiError(503, message);
  }
}
