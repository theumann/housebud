"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

// primary: the main action of a card or form. secondary: other actions.
// ghost: no border (icon buttons, Cancel, Undo). outline: a teal outline for
// an action that stands out without being the main one. danger: confirming
// something destructive. danger-subtle: destructive actions in a list (Leave,
// Remove), red text and outline.
type Variant =
  "primary" | "secondary" | "ghost" | "outline" | "danger" | "danger-subtle";
// sm for actions in a row of a list, md for the rest.
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: "border-transparent bg-primary-600 text-white hover:bg-primary-700",
  secondary:
    "border-border-subtle bg-surface text-foreground hover:bg-surface-muted",
  ghost:
    "border-transparent bg-transparent text-foreground-soft hover:bg-surface-muted",
  outline:
    "border-primary-500 bg-transparent text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-600/20",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700",
  "danger-subtle":
    "border-red-300 bg-transparent text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) => {
    const base =
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

    const sizeClasses =
      size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(base, sizeClasses, VARIANTS[variant], className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

// The "Add …" button at the top of a card. Below the sm breakpoint it shrinks
// to a "+", with the label kept as its accessible name.
export const AddButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "children" | "variant" | "size"> & { label: string }
>(({ label, className, ...props }, ref) => (
  <Button
    ref={ref}
    aria-label={label}
    className={clsx("shrink-0 max-sm:size-9 max-sm:px-0", className)}
    {...props}
  >
    <PlusIcon />
    <span className="max-sm:sr-only">{label}</span>
  </Button>
));

AddButton.displayName = "AddButton";
