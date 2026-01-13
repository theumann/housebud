export class AuthError extends Error {
  statusCode = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}
