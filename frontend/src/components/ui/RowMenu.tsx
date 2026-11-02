"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMenuDismiss } from "@/hooks/useMenuDismiss";
import { Button } from "@/components/ui/Button";

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  testId?: string;
  danger?: boolean;
}

// The "⋯" button on a list row, holding its less frequent actions (Edit,
// Delete…) so each row shows only its main one.
export function RowMenu({
  label,
  items,
  testId,
  disabled,
}: {
  // Accessible name, e.g. "More actions for Take out trash".
  label: string;
  items: RowMenuItem[];
  testId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useMenuDismiss(open, close, container, button);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={container} className="relative shrink-0">
      <Button
        ref={button}
        data-testid={testId}
        variant="ghost"
        size="sm"
        className="px-2"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </Button>

      {open && (
        <div
          ref={menu}
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-40 overflow-hidden rounded-lg border border-border-subtle bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-testid={item.testId}
              className={clsx(
                "block w-full whitespace-nowrap px-4 py-2 text-left text-sm hover:bg-surface-muted focus:bg-surface-muted focus:outline-none",
                item.danger
                  ? "text-red-700 dark:text-red-400"
                  : "text-foreground-soft",
              )}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
