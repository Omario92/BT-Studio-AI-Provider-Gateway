export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details?: any) {
    super(400, message, code, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, message, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, message, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource Not Found', code = 'NOT_FOUND') {
    super(404, message, code);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(500, message, code, details);
  }
}
