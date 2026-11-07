"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

// Shown when rendering fails outside any other error boundary; reports the
// error to Sentry (a no-op without NEXT_PUBLIC_SENTRY_DSN).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-surface-muted p-4 text-foreground">
        <main className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted">
            The error was reported. Reloading the page usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
