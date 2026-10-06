"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { useHouseholds } from "@/hooks/useHouseholds";
import { InviteInbox } from "@/components/household/InviteInbox";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function SingleFieldForm({
  testId,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  submittingLabel,
  inputClassName,
  onSubmit,
}: {
  testId: string;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  submittingLabel: string;
  inputClassName?: string;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="block text-sm">
            <span className="mb-1 block">{label}</span>
            <input
              data-testid={`${testId}-input`}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={clsx(
                "w-full border rounded px-3 py-2",
                inputClassName,
              )}
              placeholder={placeholder}
              maxLength={80}
            />
          </label>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button
            data-testid={`${testId}-submit`}
            type="submit"
            disabled={submitting || !value.trim()}
          >
            {submitting ? submittingLabel : submitLabel}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function HouseholdPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    households,
    loadingHouseholds,
    householdsError,
    createHousehold,
    joinByCode,
  } = useHouseholds();
  const firstId = households[0]?.id;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Each household lives at /household/[id]; this page is for people with
  // none yet (and for invites), so members go straight to their first one.
  useEffect(() => {
    if (firstId) router.replace(`/household/${firstId}`);
  }, [firstId, router]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  return (
    <PageContainer data-testid="household-page">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Household</h1>
        <p className="text-sm text-gray-600">
          The people you live with, in one place.
        </p>
      </header>

      {householdsError && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {householdsError}
        </div>
      )}

      <InviteInbox
        onAccepted={(householdId) => router.push(`/household/${householdId}`)}
      />

      {(loadingHouseholds || firstId) && <p>Loading...</p>}

      {!loadingHouseholds && !householdsError && !firstId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SingleFieldForm
            testId="create-household"
            title="Start a household"
            description="Create a household and invite the people you live with."
            label="Household name"
            placeholder="e.g. Maple Street House"
            submitLabel="Create household"
            submittingLabel="Creating…"
            onSubmit={createHousehold}
          />
          <SingleFieldForm
            testId="join-household"
            title="Join a household"
            description="Got a code from a roommate? Enter it here."
            label="Join code"
            placeholder="ABC234"
            submitLabel="Join household"
            submittingLabel="Joining…"
            inputClassName="font-mono uppercase tracking-widest"
            onSubmit={joinByCode}
          />
        </div>
      )}
    </PageContainer>
  );
}
