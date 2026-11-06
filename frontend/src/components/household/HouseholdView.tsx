"use client";

import { FormEvent, useId, useState } from "react";
import Link from "next/link";
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
import { Chevron } from "@/components/ui/Chevron";

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

function CopyJoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        data-testid="household-join-code"
        className="font-mono text-lg font-semibold tracking-[0.2em]"
      >
        {code}
      </span>
      <Button
        data-testid="copy-join-code"
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy join code"}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function NewJoinCode({ admin }: { admin: Admin }) {
  const { busy, error, run } = useAction();

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">
          A new code stops the current one from working.
        </p>
        <Button
          data-testid="regenerate-join-code"
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={handleRegenerate}
        >
          {busy ? "Creating…" : "New code"}
        </Button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

// The join code stays in view; the owner's tools (new code, email invites)
// fold away, open from the start while the owner is still on their own.
function InviteHousemates({
  household,
  isOwner,
  admin,
}: {
  household: Household;
  isOwner: boolean;
  admin: Admin;
}) {
  const [open, setOpen] = useState(household.members.length === 1);
  const bodyId = useId();
  const pending = admin.sentInvites.length;
  const hint =
    isOwner && pending > 0
      ? `${pending} pending invite${pending === 1 ? "" : "s"}`
      : "Share the code so roommates can join";

  const title = (
    <span className="min-w-0">
      <span className="block text-sm font-semibold">Invite housemates</span>
      <span className="block text-xs text-muted">{hint}</span>
    </span>
  );

  return (
    <section className="flex flex-col gap-4 border-t border-border-subtle pt-4">
      <div className="flex items-center justify-between gap-3">
        {isOwner ? (
          <button
            type="button"
            data-testid="household-invite-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
            className="-mx-1 -mt-4 -mb-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 pt-4 pb-2 text-left"
          >
            <Chevron className={open ? "" : "-rotate-90"} />
            {title}
          </button>
        ) : (
          title
        )}
        <CopyJoinCode code={household.joinCode} />
      </div>
      {isOwner && open && (
        <div id={bodyId} className="flex flex-col gap-4">
          <NewJoinCode admin={admin} />
          <InviteByEmail admin={admin} />
        </div>
      )}
    </section>
  );
}

function MemberRow({
  household,
  member,
  isMe,
  isOwner,
  admin,
}: {
  household: Household;
  member: HouseholdMember;
  isMe: boolean;
  isOwner: boolean;
  admin: Admin;
}) {
  const { busy, error, run } = useAction();
  const name = getUserDisplayName(member.user);
  const canManage = isOwner && !isMe;
  // The backend refuses to let the only owner leave: ownership has to be
  // handed over first (the settings page says so).
  const canLeave = isMe && !isOwner;

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
          ? `\n\nYou still owe ${money}. Your housemates will keep seeing it after you leave.`
          : balance > 0
            ? `\n\nYou're still owed ${money}. Payments to you can still be recorded after you leave.`
            : "";
      if (!window.confirm(`Leave ${household.name}?${warning}`)) return;
      await admin.leave();
    });

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
        {(canManage || canLeave) && (
          <div className="ml-auto">
            <RowMenu
              testId={`member-menu-${member.userId}`}
              label={isMe ? "More actions for you" : `More actions for ${name}`}
              disabled={busy !== null}
              items={
                canLeave
                  ? [
                      {
                        label: "Leave household",
                        testId: "leave-household",
                        danger: true,
                        onSelect: handleLeave,
                      },
                    ]
                  : [
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
                    ]
              }
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

function RenameHousehold({
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
  );
}

// /household/[id]/settings, reached from the gear on the Overview. Owner
// only; a member who opens it is told so.
export function HouseholdSettingsView({
  household,
  onChanged,
}: {
  household: Household;
  onChanged: () => Promise<void>;
}) {
  const admin = useHouseholdAdmin(household, onChanged);

  if (household.myRole !== "owner") {
    return (
      <Card data-testid="household-settings-owner-only">
        <CardBody className="pt-4 text-sm text-muted">
          Only the owner can change the household&apos;s settings.{" "}
          <Link
            href={`/household/${household.id}`}
            className="text-primary-700 underline-offset-2 hover:underline dark:text-primary-400"
          >
            Back to Overview
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div data-testid="household-owner-tools" className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-4 pt-4">
          <RenameHousehold
            key={household.id}
            household={household}
            admin={admin}
          />
          <ModuleSettings household={household} admin={admin} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Leaving</h2>
        </CardHeader>
        <CardBody>
          <p data-testid="owner-leave-note" className="text-sm text-muted">
            {household.members.length > 1
              ? "As the owner, you can't leave yet: make another member the owner first (from their ⋯ menu on the Overview), then leave from your own."
              : "You're the only member of this household."}
          </p>
        </CardBody>
      </Card>
    </div>
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
          <span className="mb-1 block">Invite by email</span>
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

// The Overview below "Coming up": members and how to invite more. The
// owner's settings are on their own page (the gear in the page header).
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
        <h2 className="text-lg font-semibold">
          Members ({household.members.length})
        </h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <ul data-testid="household-members" className="flex flex-col gap-2">
          {household.members.map((m) => (
            <MemberRow
              key={m.id}
              household={household}
              member={m}
              isMe={m.userId === user?.id}
              isOwner={isOwner}
              admin={admin}
            />
          ))}
        </ul>

        <InviteHousemates
          key={household.id}
          household={household}
          isOwner={isOwner}
          admin={admin}
        />
      </CardBody>
    </Card>
  );
}
