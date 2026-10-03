"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Household, HouseholdMember } from "@/hooks/useHouseholds";
import { useHouseholdAdmin } from "@/hooks/useHouseholdAdmin";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName } from "@/lib/displayName";

type Admin = ReturnType<typeof useHouseholdAdmin>;

// Runs one action at a time and keeps its error, so every button behaves the
// same: disabled while busy, error shown next to it.
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return { busy, error, run };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

function JoinCode({
  code,
  isOwner,
  admin,
}: {
  code: string;
  isOwner: boolean;
  admin: Admin;
}) {
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    if (
      !window.confirm(
        "Create a new join code? The current code will stop working.",
      )
    ) {
      return;
    }
    run("regenerate", admin.regenerateJoinCode);
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface px-4 py-3">
      <p className="text-xs text-gray-600">
        Share this code with roommates so they can join.
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          data-testid="household-join-code"
          className="font-mono text-xl font-semibold tracking-[0.3em]"
        >
          {code}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          {isOwner && (
            <Button
              data-testid="regenerate-join-code"
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={handleRegenerate}
            >
              {busy ? "Creating…" : "New code"}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isMe,
  isOwner,
  admin,
}: {
  member: HouseholdMember;
  isMe: boolean;
  isOwner: boolean;
  admin: Admin;
}) {
  const { busy, error, run } = useAction();
  const name = getUserDisplayName(member.user);
  const canManage = isOwner && !isMe;

  const handleMakeOwner = () => {
    if (
      !window.confirm(
        `Make ${name} the owner? You'll become a regular member and lose owner controls.`,
      )
    ) {
      return;
    }
    run("owner", () => admin.makeOwner(member.userId));
  };

  const handleRemove = () => {
    if (!window.confirm(`Remove ${name} from the household?`)) return;
    run("remove", () => admin.removeMember(member.userId));
  };

  return (
    <li
      data-testid={`household-member-${member.userId}`}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-sm font-semibold">
          {member.user.profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.user.profile.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (name[0]?.toUpperCase() ?? "?")
          )}
        </div>
        <span className="min-w-0 truncate text-sm">
          {name}
          {isMe && <span className="text-gray-500"> (you)</span>}
        </span>
        {member.role === "owner" && (
          <span className="text-xs text-gray-500">Owner</span>
        )}
        {canManage && (
          <div className="ml-auto flex gap-2">
            <Button
              data-testid={`make-owner-${member.userId}`}
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={handleMakeOwner}
            >
              Make owner
            </Button>
            <Button
              data-testid={`remove-member-${member.userId}`}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              disabled={busy !== null}
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      <ErrorNote error={error} />
    </li>
  );
}

function OwnerTools({
  household,
  admin,
}: {
  household: Household;
  admin: Admin;
}) {
  const [name, setName] = useState(household.name);
  const [email, setEmail] = useState("");
  const rename = useAction();
  const invite = useAction();
  const revoke = useAction();

  const handleRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === household.name) return;
    rename.run("rename", () => admin.rename(trimmed));
  };

  const handleInvite = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    invite.run("invite", async () => {
      await admin.inviteByEmail(trimmed);
      setEmail("");
    });
  };

  return (
    <section
      data-testid="household-owner-tools"
      className="flex flex-col gap-4 border-t border-border-subtle pt-4"
    >
      <h3 className="text-sm font-semibold">Owner settings</h3>

      <form onSubmit={handleRename} className="flex flex-col gap-2">
        <label className="text-sm">
          <span className="mb-1 block">Household name</span>
          <div className="flex gap-2">
            <input
              data-testid="rename-household-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded border px-3 py-2"
            />
            <Button
              data-testid="rename-household-submit"
              type="submit"
              variant="secondary"
              disabled={
                rename.busy !== null ||
                !name.trim() ||
                name.trim() === household.name
              }
            >
              {rename.busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </label>
        <ErrorNote error={rename.error} />
      </form>

      <form onSubmit={handleInvite} className="flex flex-col gap-2">
        <label className="text-sm">
          <span className="mb-1 block">Invite by email</span>
          <div className="flex gap-2">
            <input
              data-testid="invite-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="roommate@example.com"
              className="w-full rounded border px-3 py-2"
            />
            <Button
              data-testid="invite-email-submit"
              type="submit"
              disabled={invite.busy !== null || !email.trim()}
            >
              {invite.busy ? "Inviting…" : "Invite"}
            </Button>
          </div>
        </label>
        <p className="text-xs text-gray-500">
          If they already have an account with this email, they will see the
          invite under Household.
        </p>
        <ErrorNote error={invite.error} />
      </form>

      {admin.sentInvites.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">
            Pending invites ({admin.sentInvites.length})
          </h4>
          <ul
            data-testid="household-sent-invites"
            className="flex flex-col gap-2"
          >
            {admin.sentInvites.map((invite) => (
              <li
                key={invite.id}
                data-testid={`sent-invite-${invite.id}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">{invite.email}</span>
                <Button
                  data-testid={`revoke-invite-${invite.id}`}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  disabled={revoke.busy !== null}
                  onClick={() =>
                    revoke.run(invite.id, () => admin.revokeInvite(invite.id))
                  }
                >
                  {revoke.busy === invite.id ? "Revoking…" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
          <ErrorNote error={revoke.error} />
        </div>
      )}
    </section>
  );
}

function LeaveHousehold({
  household,
  admin,
}: {
  household: Household;
  admin: Admin;
}) {
  const { busy, error, run } = useAction();

  // The backend refuses to let the only owner leave: ownership has to be
  // handed over first, so the household is never left without an owner.
  if (household.myRole === "owner") {
    return (
      <p className="text-xs text-gray-500">
        {household.members.length > 1
          ? "To leave this household, make another member the owner first."
          : "You're the only member of this household."}
      </p>
    );
  }

  const handleLeave = () => {
    if (!window.confirm(`Leave ${household.name}?`)) return;
    run("leave", admin.leave);
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        data-testid="leave-household"
        variant="ghost"
        size="sm"
        className="self-start text-red-600 hover:bg-red-50"
        disabled={busy !== null}
        onClick={handleLeave}
      >
        {busy ? "Leaving…" : "Leave household"}
      </Button>
      <ErrorNote error={error} />
    </div>
  );
}

export function HouseholdView({
  household,
  onChanged,
}: {
  household: Household;
  onChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const admin = useHouseholdAdmin(household, onChanged);
  const isOwner = household.myRole === "owner";

  return (
    <Card data-testid="household-view">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <h2 data-testid="household-name" className="text-xl font-semibold">
            {household.name}
          </h2>
          <span
            data-testid="household-my-role"
            className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-600/20 dark:text-primary-100"
          >
            {isOwner ? "Owner" : "Member"}
          </span>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <JoinCode code={household.joinCode} isOwner={isOwner} admin={admin} />

        <section>
          <h3 className="mb-2 text-sm font-semibold">
            Members ({household.members.length})
          </h3>
          <ul data-testid="household-members" className="flex flex-col gap-2">
            {household.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.userId === user?.id}
                isOwner={isOwner}
                admin={admin}
              />
            ))}
          </ul>
        </section>

        {isOwner && (
          <OwnerTools key={household.id} household={household} admin={admin} />
        )}

        <LeaveHousehold household={household} admin={admin} />
      </CardBody>
    </Card>
  );
}
