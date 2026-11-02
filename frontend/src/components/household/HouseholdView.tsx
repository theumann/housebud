"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Household, HouseholdMember } from "@/hooks/useHouseholds";
import { useHouseholdAdmin } from "@/hooks/useHouseholdAdmin";
import { formatMoney } from "@/hooks/useExpenses";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RowMenu } from "@/components/ui/RowMenu";
import { getUserDisplayName } from "@/lib/displayName";
import { Input, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";

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
      <p className="text-xs text-muted">
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
        <Avatar
          userId={member.userId}
          name={name}
          avatarUrl={member.user.profile?.avatarUrl}
          size="sm"
        />
        <span className="min-w-0 truncate text-sm">
          {name}
          {isMe && <span className="text-subtle"> (you)</span>}
        </span>
        {member.role === "owner" && (
          <span className="text-xs text-subtle">Owner</span>
        )}
        {canManage && (
          <div className="ml-auto">
            <RowMenu
              testId={`member-menu-${member.userId}`}
              label={`More actions for ${name}`}
              disabled={busy !== null}
              items={[
                {
                  label: "Make owner",
                  testId: `make-owner-${member.userId}`,
                  onSelect: handleMakeOwner,
                },
                {
                  label: "Remove from household",
                  testId: `remove-member-${member.userId}`,
                  danger: true,
                  onSelect: handleRemove,
                },
              ]}
            />
          </div>
        )}
      </div>
      <ErrorNote error={error} />
    </li>
  );
}

// Add each module here together with the module itself.
const MODULE_TOGGLES = [
  { key: "chatEnabled", label: "Chat", testId: "chat" },
  { key: "choresEnabled", label: "Chores", testId: "chores" },
  { key: "shoppingEnabled", label: "Shopping list", testId: "shopping" },
  { key: "expensesEnabled", label: "Expenses", testId: "expenses" },
  { key: "rulesEnabled", label: "House rules", testId: "rules" },
  { key: "calendarEnabled", label: "Calendar", testId: "calendar" },
] as const;
type ModuleKey = (typeof MODULE_TOGGLES)[number]["key"];

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "CHF"];

function ModuleSettings({
  household,
  admin,
}: {
  household: Household;
  admin: Admin;
}) {
  const { busy, error, run } = useAction();
  // Shows the new value while the change saves; the reloaded settings take
  // over afterwards (or the old value comes back if it failed).
  const [pending, setPending] = useState<{
    key: ModuleKey;
    enabled: boolean;
  } | null>(null);

  const toggle = async (key: ModuleKey, enabled: boolean) => {
    setPending({ key, enabled });
    await run(key, () => admin.updateSettings({ [key]: enabled }));
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">Features</span>
      {MODULE_TOGGLES.map((m) => (
        <label key={m.key} className="flex items-center gap-2 text-sm">
          <input
            data-testid={`module-toggle-${m.testId}`}
            type="checkbox"
            checked={
              pending?.key === m.key
                ? pending.enabled
                : household.settings[m.key]
            }
            disabled={busy !== null}
            onChange={(e) => toggle(m.key, e.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          {m.label}
        </label>
      ))}
      {household.settings.expensesEnabled && (
        <label className="flex items-center gap-2 text-sm">
          Currency
          <Select
            data-testid="currency-select"
            value={household.settings.currency}
            disabled={busy !== null}
            onChange={(e) =>
              run("currency", () =>
                admin.updateSettings({ currency: e.target.value }),
              )
            }
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

// Owner only, and collapsed until opened: it's long and rarely changed.
function HouseholdSettings({
  household,
  admin,
}: {
  household: Household;
  admin: Admin;
}) {
  const [name, setName] = useState(household.name);
  const rename = useAction();

  const handleRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === household.name) return;
    rename.run("rename", () => admin.rename(trimmed));
  };

  return (
    <Card data-testid="household-owner-tools">
      <details className="group">
        <summary
          data-testid="household-settings-toggle"
          className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card p-4 [&::-webkit-details-marker]:hidden"
        >
          <span>
            <span className="block text-lg font-semibold">
              Household settings
            </span>
            <span className="block text-sm text-muted">
              Name, features and currency
            </span>
          </span>
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
            className="shrink-0 text-muted transition group-open:rotate-180"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <form onSubmit={handleRename} className="flex flex-col gap-2">
            <label className="text-sm">
              <span className="mb-1 block">Household name</span>
              <div className="flex gap-2">
                <Input
                  data-testid="rename-household-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="min-w-0 flex-1"
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

          <ModuleSettings household={household} admin={admin} />
        </div>
      </details>
    </Card>
  );
}

function InviteByEmail({ admin }: { admin: Admin }) {
  const [email, setEmail] = useState("");
  const invite = useAction();
  const revoke = useAction();

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
    <>
      <form onSubmit={handleInvite} className="flex flex-col gap-2">
        <label className="text-sm">
          <span className="mb-1 block">Or invite by email</span>
          <div className="flex gap-2">
            <Input
              data-testid="invite-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="roommate@example.com"
              className="min-w-0 flex-1"
            />
            <Button
              data-testid="invite-email-submit"
              type="submit"
              variant="secondary"
              disabled={invite.busy !== null || !email.trim()}
            >
              {invite.busy ? "Inviting…" : "Invite"}
            </Button>
          </div>
        </label>
        <p className="text-xs text-subtle">
          They&apos;ll see the invite under Household once they&apos;re signed
          up with this email (within 14 days). No email is sent yet.
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
                  variant="danger-subtle"
                  size="sm"
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
    </>
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
      <p className="text-xs text-subtle">
        {household.members.length > 1
          ? "To leave this household, make another member the owner first."
          : "You're the only member of this household."}
      </p>
    );
  }

  const handleLeave = () =>
    run("leave", async () => {
      // Leaving with money still open is allowed; the others keep seeing the
      // balance and can record payments with a former member.
      const balance = household.settings.expensesEnabled
        ? await admin.myBalanceCents()
        : 0;
      const money = formatMoney(Math.abs(balance), household.settings.currency);
      const warning =
        balance < 0
          ? `

You still owe ${money}. Your housemates will keep seeing it after you leave.`
          : balance > 0
            ? `

You're still owed ${money}. Payments to you can still be recorded after you leave.`
            : "";
      if (!window.confirm(`Leave ${household.name}?${warning}`)) return;
      await admin.leave();
    });

  return (
    <div className="flex flex-col gap-2">
      <Button
        data-testid="leave-household"
        variant="danger-subtle"
        size="sm"
        className="self-start"
        disabled={busy !== null}
        onClick={handleLeave}
      >
        {busy ? "Leaving…" : "Leave household"}
      </Button>
      <ErrorNote error={error} />
    </div>
  );
}

// The Overview below "Coming up": members and how to invite more, then the
// owner's settings.
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
    <div data-testid="household-view" className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            Members ({household.members.length})
          </h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
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

          <section className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <h3 className="text-sm font-semibold">Invite housemates</h3>
            <JoinCode
              code={household.joinCode}
              isOwner={isOwner}
              admin={admin}
            />
            {isOwner && <InviteByEmail admin={admin} />}
          </section>

          <div className="border-t border-border-subtle pt-4">
            <LeaveHousehold household={household} admin={admin} />
          </div>
        </CardBody>
      </Card>

      {isOwner && (
        <HouseholdSettings
          key={household.id}
          household={household}
          admin={admin}
        />
      )}
    </div>
  );
}
