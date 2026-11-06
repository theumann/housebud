import clsx from "clsx";

// Points down; rotate it for other directions (e.g. "-rotate-90" for closed).
export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("shrink-0 text-muted transition", className)}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
