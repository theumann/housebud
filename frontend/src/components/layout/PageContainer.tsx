"use client";

import clsx from "clsx";
import React from "react";
import { AppNav } from "@/components/layout/AppNav";
import { useAuth } from "@/context/AuthContext";

// Demo visitors' throwaway accounts (backend: SANDBOX_EMAIL_DOMAIN).
const SANDBOX_EMAIL_SUFFIX = "@sandbox.example.com";

type PageContainerProps = React.HTMLAttributes<HTMLElement>;

export function PageContainer({
  children,
  className,
  ...props
}: PageContainerProps) {
  const { user } = useAuth();

  // A real wrapper element (not a fragment) keeps the nav and <main> under a
  // parent only React touches, so the nav is always inserted above <main>.
  return (
    <div>
      {user && <AppNav />}
      {user?.email.endsWith(SANDBOX_EMAIL_SUFFIX) && (
        <p
          data-testid="demo-banner"
          className="border-b border-border-subtle bg-primary-50 px-4 py-2 text-center text-xs text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
        >
          You&apos;re exploring a demo household. Make yourself at home: it
          resets after a day.
        </p>
      )}
      <main
        {...props}
        className={clsx("min-h-screen bg-surface-muted", className)}
      >
        <section className="max-w-5xl mx-auto px-4 py-6">{children}</section>
      </main>
    </div>
  );
}
