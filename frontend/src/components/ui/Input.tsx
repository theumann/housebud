"use client";

import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";
import clsx from "clsx";

// No width here: callers set it (w-full, w-20…), so it never fights theirs.
const fieldClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm placeholder:text-faint transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:scheme-dark";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={clsx(fieldClasses, className)} {...props} />
));

Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={clsx(fieldClasses, className)} {...props} />
));

Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={clsx(fieldClasses, className)} {...props} />
));

Textarea.displayName = "Textarea";
