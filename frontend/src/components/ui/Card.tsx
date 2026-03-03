"use client";

import clsx from "clsx";
import React from "react";

type CardProps = React.HTMLAttributes<HTMLElement>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <article
      {...props}
      className={clsx(
        "flex flex-col rounded-card border border-border-subtle bg-gradient-to-br from-theme-from to-theme-to shadow-soft",
        className,
      )}
    >
      {children}
    </article>
  );
}

type CardHeaderProps = React.HTMLAttributes<HTMLElement>;

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <header {...props} className={clsx("px-4 pt-4 pb-2", className)}>
      {children}
    </header>
  );
}

type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;

export function CardBody({ children, className, ...props }: CardBodyProps) {
  return (
    <div {...props} className={clsx("flex-1 px-4 pb-3 pt-1", className)}>
      {children}
    </div>
  );
}

type CardFooterProps = React.HTMLAttributes<HTMLElement>;

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <footer
      {...props}
      className={clsx(
        "px-4 pb-4 pt-2 border-t border-border-subtle flex flex-col gap-2",
        className,
      )}
    >
      {children}
    </footer>
  );
}
