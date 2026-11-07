import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import * as Sentry from "@sentry/node";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Controllers parse input with Zod: a failure is the client's mistake.
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) =>
        i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
      )
      .join("; ");
    return res.status(400).json({ error: message });
  }

  console.error(err);

  const status = err.statusCode ?? err.status ?? 500;
  if (err.retryAfterSeconds)
    res.set("Retry-After", String(err.retryAfterSeconds));
  const message = err.message || "Internal Server Error";
  // 4xx are the client's mistakes, answered on purpose; only crashes and
  // other server errors go to Sentry (a no-op without SENTRY_DSN).
  if (status >= 500) Sentry.captureException(err);

  res.status(status).json({ error: message });
}
