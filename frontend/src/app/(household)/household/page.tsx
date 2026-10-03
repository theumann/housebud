"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { useHouseholds } from "@/hooks/useHouseholds";
import { HouseholdView } from "@/components/household/HouseholdView";
import { useHouseholdInvites } from "@/context/HouseholdInvitesContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";

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

function InviteInbox({
  onAccepted,
}: {
  onAccepted: (householdId: string) => Promise<void>;
}) {
  const { invites, accept, decline } = useHouseholdInvites();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  const respond = async (
    inviteId: string,
    householdId: string,
    action: "accept" | "decline",
  ) => {
    setBusyId(inviteId);
    setError(null);
    try {
      if (action === "accept") {
        await accept(inviteId);
        await onAccepted(householdId);
      } else {
        await decline(inviteId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section data-testid="household-invites" className="mb-4">
      <h2 className="mb-2 text-sm font-semibold">
        Invitations ({invites.length})
      </h2>
      {error && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {invites.map((invite) => (
          <li
            key={invite.id}
            data-testid={`household-invite-${invite.id}`}
            className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold">{invite.household.name}</p>
              {invite.invitedByUser && (
                <p className="text-xs text-gray-600">
                  Invited by {getUserDisplayName(invite.invitedByUser)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                data-testid={`household-invite-accept-${invite.id}`}
                size="sm"
                disabled={busyId !== null}
                onClick={() =>
                  respond(invite.id, invite.household.id, "accept")
                }
              >
                {busyId === invite.id ? "Joining…" : "Accept"}
              </Button>
              <Button
                data-testid={`household-invite-decline-${invite.id}`}
                size="sm"
                variant="secondary"
                disabled={busyId !== null}
                onClick={() =>
                  respond(invite.id, invite.household.id, "decline")
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HouseholdPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const {
    households,
    loadingHouseholds,
    householdsError,
    reload,
    createHousehold,
    joinByCode,
  } = useHouseholds();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  const selected =
    households.find((h) => h.id === selectedId) ?? households[0] ?? null;

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
        onAccepted={async (householdId) => {
          await reload();
          setSelectedId(householdId);
        }}
      />

      {loadingHouseholds && households.length === 0 && <p>Loading...</p>}

      {!loadingHouseholds && !householdsError && households.length === 0 && (
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

      {households.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {households.map((h) => (
            <Button
              key={h.id}
              size="sm"
              variant={h.id === selected?.id ? "primary" : "secondary"}
              onClick={() => setSelectedId(h.id)}
            >
              {h.name}
            </Button>
          ))}
        </div>
      )}

      {selected && (
        // keyed so switching households resets per-household state (e.g. pending invites)
        <HouseholdView
          key={selected.id}
          household={selected}
          onChanged={reload}
        />
      )}
    </PageContainer>
  );
}
