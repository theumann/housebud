import clsx from "clsx";
import React from "react";
import { Logo } from "@/components/Logo";

type AuthLayoutProps = React.HTMLAttributes<HTMLElement> & {
  title: string;
  subtitle: string;
  wide?: boolean;
};

export function AuthLayout({
  title,
  subtitle,
  wide,
  children,
  ...props
}: AuthLayoutProps) {
  return (
    <main
      {...props}
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10"
    >
      <Logo size="lg" />
      <section
        className={clsx(
          "w-full rounded-card border border-border-subtle bg-surface p-6 shadow-soft sm:p-8",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
