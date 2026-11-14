import clsx from "clsx";
import React from "react";
import { ModuleTile, type ModuleIconName } from "@/components/icons/ModuleIcon";

// The title of a page, above its cards (which can have titles of their own),
// with an optional description, an optional module icon on the left and an
// action on the right (e.g. AddButton).
export function PageHeader({
  title,
  icon,
  description,
  action,
  titleTestId,
  className,
}: {
  title: React.ReactNode;
  icon?: ModuleIconName;
  description?: React.ReactNode;
  action?: React.ReactNode;
  titleTestId?: string;
  className?: string;
}) {
  // Without a description the title alone is shorter than the icon: center
  // both, and the action with them.
  const align = description ? "items-start" : "items-center";
  return (
    <header className={clsx("flex justify-between gap-3", align, className)}>
      <div className={clsx("flex min-w-0 gap-3", align)}>
        {icon && <ModuleTile name={icon} />}
        <div className="min-w-0">
          <h1 data-testid={titleTestId} className="text-xl font-bold">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      </div>
      {action}
    </header>
  );
}
