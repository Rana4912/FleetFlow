export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export class ResourceConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ResourceConflictError";
  }
}