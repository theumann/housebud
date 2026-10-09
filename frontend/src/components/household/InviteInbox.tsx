"use client";

import { useState } from "react";
import { useHouseholdInvites } from "@/context/HouseholdInvitesContext";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";

export function InviteInbox({
  onAccepted,
}: {
  onAccepted: (householdId: string) => void;
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
        onAccepted(householdId);
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
                <p className="text-xs text-muted">
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
