"use client";

import clsx from "clsx";
import React from "react";
import { AppNav } from "@/components/layout/AppNav";
import { useAuth } from "@/context/AuthContext";

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
      <main
        {...props}
        className={clsx("min-h-screen bg-surface-muted", className)}
      >
        <section className="max-w-5xl mx-auto px-4 py-6">{children}</section>
      </main>
    </div>
  );
}
