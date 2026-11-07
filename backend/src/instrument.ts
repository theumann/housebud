import * as Sentry from "@sentry/node";
import type { ErrorEvent } from "@sentry/node";

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
    beforeSend: scrubEvent,
  });
}
