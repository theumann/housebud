import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

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
  const message = err.message || "Internal Server Error";

  res.status(status).json({ error: message });
}
