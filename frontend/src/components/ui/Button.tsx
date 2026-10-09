"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) => {
    const base =
      "inline-flex items-center justify-center rounded-md border text-sm font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:brightness-95 active:scale-[0.98]";

    const sizeClasses =
      size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";

    const variantClasses =
      variant === "primary"
        ? "border-transparent bg-primary-600 text-white hover:bg-primary-700"
        : variant === "secondary"
          ? "border border-border-subtle bg-surface text-foreground hover:bg-surface-muted"
          : variant === "danger"
            ? "border-transparent bg-red-600 text-white hover:bg-red-700"
            : "bg-transparent text-foreground-soft hover:bg-surface-muted"; // ghost

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(base, sizeClasses, variantClasses, className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
