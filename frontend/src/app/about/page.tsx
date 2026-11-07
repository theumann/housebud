"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { TesterNotice } from "@/components/notice/TesterNotice";

const link =
  "font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400";

// Readable logged out too: the signup page links here, and so do invites.
export default function AboutPage() {
  const { user, loading } = useAuth();

  return (
    <PageContainer data-testid="about-page">
      <PageHeader
        title="About HouseBud"
        description="An app for running a shared home, being tested by its first households."
      />

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="text-base font-semibold">Tester notice</h2>
        <TesterNotice />
      </Card>

      <Card className="mt-4 space-y-3 p-5 text-sm text-foreground-soft">
        <h2 className="text-base font-semibold text-foreground">
          HouseBud on your phone
        </h2>
        <p>
          <strong>iPhone:</strong> open housebud.app in Safari, tap Share (the
          square with an arrow; on newer iPhones it may be under ⋯), then{" "}
          <strong>Add to Home Screen</strong>. Open HouseBud from the new icon
          and log in once more: it keeps its own login, separate from Safari.
        </p>
        <p>
          <strong>Android:</strong> open it in Chrome and tap{" "}
          <strong>Install app</strong> (or ⋮ → Add to Home screen).
        </p>
      </Card>

      {!loading && !user && (
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/signup" className={link}>
            Sign up
          </Link>{" "}
          or{" "}
          <Link href="/login" className={link}>
            log in
          </Link>
        </p>
      )}
    </PageContainer>
  );
}
