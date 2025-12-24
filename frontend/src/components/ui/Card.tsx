"use client";

import clsx from "clsx";
import React from "react";

type CardProps = React.HTMLAttributes<HTMLElement>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <article
      {...props}
      className={clsx(
        "rounded-card border border-border-subtle bg-surface shadow-soft",
        className
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
    <div {...props} className={clsx("px-4 pb-3 pt-1", className)}>
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
        "px-4 pb-4 pt-2 border-t border-gray-100 flex flex-col gap-2",
        className
      )}
    >
      {children}
    </footer>
  );
}
