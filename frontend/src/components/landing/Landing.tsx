"use client";

import Link from "next/link";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import { useSignupOptions } from "@/hooks/useSignupOptions";
import { matchingEnabled } from "@/lib/features";

const FEATURES = [
  ...(matchingEnabled
    ? [
        {
          title: "Find roommates",
          text: "Answer a few questions about how you live, see who fits, and chat before you decide.",
        },
      ]
    : []),
  {
    title: "Chores",
    text: "Repeating chores with turns that rotate, so everyone knows whose week it is.",
  },
  {
    title: "Shopping list",
    text: "One list for the house. Check things off at the store and turn the trip into a shared expense.",
  },
  {
    title: "Expenses",
    text: "Split bills and groceries, see who owes whom, and settle up with suggested payments.",
  },
  {
    title: "House rules",
    text: "Agree on rules together: every change is a proposal that everyone signs off on.",
  },
  {
    title: "Calendar",
    text: "House events, who's away, who has a guest over, and the chores coming up.",
  },
  {
    title: "House chat",
    text: "A chat for the people who live there, nobody else.",
  },
];

const link =
  "font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400";

// What logged-out visitors see on "/".
export function Landing() {
  const { demoAvailable } = useSignupOptions();

  return (
    <main
      data-testid="landing-page"
      className="mx-auto flex min-h-screen max-w-3xl flex-col items-center px-4 py-12 sm:py-16"
    >
      <Logo size="lg" />
      <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {matchingEnabled
          ? "Find your roommates, then run the house together"
          : "Run your shared house together"}
      </h1>
      <p className="mt-4 max-w-xl text-center text-base text-muted text-pretty">
        HouseBud is for students sharing a place.{" "}
        {matchingEnabled
          ? "Meet people who live the way you do, form a household with them, and keep "
          : "It keeps "}
        chores, groceries, money and house rules in one app everyone can see,
        instead of a group chat nobody can scroll back through.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="/login"
          data-testid="landing-login"
          className={clsx(buttonClass("primary"), "sm:min-w-32")}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          data-testid="landing-signup"
          className={clsx(buttonClass("secondary"), "sm:min-w-32")}
        >
          Sign up
        </Link>
      </div>
      {demoAvailable && (
        <p className="mt-4 text-center text-sm text-muted">
          Just looking around?{" "}
          <Link href="/demo" data-testid="landing-demo" className={link}>
            Try the demo
          </Link>
        </p>
      )}

      <section aria-labelledby="landing-features" className="mt-14 w-full">
        <h2 id="landing-features" className="sr-only">
          What&apos;s in it
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="rounded-card border border-border-subtle bg-surface p-5 shadow-soft"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-center text-sm text-muted">
        <Link href="/about" className={link}>
          About HouseBud
        </Link>
      </p>
    </main>
  );
}
