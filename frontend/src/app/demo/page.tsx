"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

// "Try the demo" links here, from the login page and from outside the app.
// Every visit starts a fresh sandbox; "/" then lands on its household.
export default function DemoPage() {
  const { startDemo } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Effects run twice in development: one sandbox per visit, not two.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startDemo()
      .then(() => router.replace("/"))
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? "The demo isn't available here."
            : err instanceof Error
              ? err.message
              : "Couldn't start the demo.",
        ),
      );
  }, [startDemo, router]);

  return (
    <main
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <Image
        src="/logo-mark.svg"
        alt=""
        width={72}
        height={72}
        unoptimized
        priority
        className={error ? undefined : "animate-pulse"}
      />
      {error ? (
        <>
          <p data-testid="demo-error" className="text-sm text-muted">
            {error}
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-primary-700 underline underline-offset-2 dark:text-primary-500"
          >
            Go to login
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">Setting up your demo household…</p>
      )}
    </main>
  );
}
