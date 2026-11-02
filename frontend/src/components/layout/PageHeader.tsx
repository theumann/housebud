import clsx from "clsx";
import React from "react";

// The title of a page, above its cards (which can have titles of their own),
// with an optional description and an action on the right (e.g. AddButton).
export function PageHeader({
  title,
  description,
  action,
  titleTestId,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleTestId?: string;
  className?: string;
}) {
  return (
    <header
      className={clsx("flex items-start justify-between gap-3", className)}
    >
      <div className="min-w-0">
        <h1 data-testid={titleTestId} className="text-xl font-bold">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
