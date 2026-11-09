import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";
import { ZodError } from "zod";

// Error tracking, only where SENTRY_DSN is set (staging and production on
// Railway): off in local dev and tests. server.ts imports this before
// anything else, so Sentry can hook into Express as it loads.

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[a-z]{2,}/gi;
const scrub = (text: string | undefined) => text?.replace(EMAIL, "[email]");

// The user id (set in authMiddleware) is the only thing about a person an
// event may carry. Prisma errors can quote the values of a failed query, so
// email addresses are blanked out of messages too.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  event.user = event.user?.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  event.message = scrub(event.message);
  for (const exception of event.exception?.values ?? []) {
    exception.value = scrub(exception.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    crumb.message = scrub(crumb.message);
  }
  return event;
}

// Answered on purpose with a 4xx, so not worth an alert. Sentry's Express
// integration also reports errors passed to next() by itself, and counts any
// without a status (a ZodError: a malformed request, answered with a 400 by
// errorHandler) as a 500.
export function isClientError(error: unknown) {
  if (error instanceof ZodError) return true;
  const status =
    (error as { statusCode?: unknown; status?: unknown } | null)?.statusCode ??
    (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status < 500;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    // No request bodies (passwords), headers (the login token), cookies,
    // query strings, query parameters or local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    beforeSend: (event, hint) =>
      isClientError(hint.originalException) ? null : scrubEvent(event),
  });
}
