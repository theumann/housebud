import * as Sentry from "@sentry/nextjs";

// Error tracking in the browser, only in builds made with
// NEXT_PUBLIC_SENTRY_DSN set (staging and production on Railway): off in
// local dev and tests. Next runs this file before the app starts.

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[a-z]{2,}/gi;
const scrub = (text: string | undefined) => text?.replace(EMAIL, "[email]");

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    // No cookies, headers, query strings (an invite link's code) or request
    // bodies; no session replay or tracing.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // The user id (set in AuthContext) is the only thing about a person an
    // event may carry; email addresses are blanked out of messages.
    beforeSend(event) {
      event.user = event.user?.id ? { id: event.user.id } : undefined;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
        event.request.url = event.request.url?.split("?")[0];
      }
      event.message = scrub(event.message);
      for (const exception of event.exception?.values ?? []) {
        exception.value = scrub(exception.value);
      }
      for (const crumb of event.breadcrumbs ?? []) {
        crumb.message = scrub(crumb.message);
      }
      return event;
    },
  });
}
