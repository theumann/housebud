"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import {
  type RuleProposal,
  type RuleUser,
  useHouseRules,
} from "@/hooks/useHouseRules";
import { ModuleOff } from "@/components/household/ModuleOff";
import {
  type ProposalDraft,
  RuleProposalForm,
} from "@/components/household/RuleProposalForm";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getUserDisplayName } from "@/lib/displayName";

// Shown while a household has no rules yet, and in the form for a new rule;
// each prefills the form, so it can be edited first.
const STARTER_RULES = [
  {
    title: "Quiet hours after 11pm",
    details: "Sunday to Thursday. Headphones for music and calls.",
  },
  {
    title: "Tell the house before overnight guests",
    details: "A message in the household chat is enough.",
  },
  {
    title: "Dishes done the same day",
    details: "Nothing left in the sink overnight.",
  },
  {
    title: "Label your food",
    details:
      "Shared staples go on the shopping list; anything else gets a name.",
  },
  {
    title: "No smoking or vaping indoors",
    details: "Outside only, away from the windows.",
  },
  {
    title: "Clean the bathroom weekly",
    details: "Follow the rotation on the Chores page.",
  },
  {
    title: "Keep common areas tidy",
    details: "Take your things back to your room by the end of the day.",
  },
  {
    title: "Pay rent and bills on time",
    details: "Settle up within a week of a bill being added to Expenses.",
  },
];

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </div>
  );
}

function RuleText({
  title,
  details,
  struck,
}: {
  title: string;
  details: string | null;
  struck?: boolean;
}) {
  return (
    <div className={struck ? "line-through" : undefined}>
      <p className="break-words font-medium">{title}</p>
      {details && (
        <p className="whitespace-pre-line break-words text-sm text-muted">
          {details}
        </p>
      )}
    </div>
  );
}

export function HouseRules({ household }: { household: Household }) {
  const { user } = useAuth();
  const data = useHouseRules(household.id);
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  // The proposal someone is saying no to, with their reason so far.
  const [declining, setDeclining] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (data.unavailable) {
    return <ModuleOff household={household} moduleName="house rules page" />;
  }

  const name = (u: RuleUser | null) =>
    !u ? "Former member" : u.id === user?.id ? "You" : getUserDisplayName(u);
  // The same, in the middle of a sentence.
  const nameMid = (u: RuleUser | null) =>
    u && u.id === user?.id ? "you" : name(u);
  const list = (users: RuleUser[]) => users.map(nameMid).join(", ");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  };

  const ruleNumber = (ruleId: string | undefined) =>
    data.rules.findIndex((r) => r.id === ruleId) + 1;
  const proposalFor = (ruleId: string) =>
    data.proposals.find((p) => p.rule?.id === ruleId);
  const takenTitles = new Set(
    [...data.rules, ...data.proposals].map((r) => r.title.toLowerCase()),
  );
  const starters = STARTER_RULES.filter(
    (s) => !takenTitles.has(s.title.toLowerCase()),
  );
  const showStarters =
    !data.loading && data.rules.length === 0 && starters.length > 0;

  const what = (p: RuleProposal) =>
    p.kind === "add"
      ? "a new rule"
      : p.kind === "change"
        ? `changing rule ${ruleNumber(p.rule?.id)}`
        : `removing rule ${ruleNumber(p.rule?.id)}`;

  const form = draft && (
    <RuleProposalForm
      draft={draft}
      starters={showStarters ? [] : starters}
      onSubmit={async (input) => {
        await data.propose(input);
        setDraft(null);
      }}
      onCancel={() => setDraft(null)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {data.needsMyAgreement && (
        <Card
          data-testid="rules-agreement"
          className="border-amber-300 dark:border-amber-500/40"
        >
          <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              These rules were agreed on before you joined. Read them, then let
              your housemates know you&apos;re on board.
            </p>
            <Button
              data-testid="rules-agree"
              className="shrink-0"
              disabled={busy}
              onClick={() => run(data.agreeToRules)}
            >
              I agree
            </Button>
          </CardBody>
        </Card>
      )}

      {data.proposals.length > 0 && (
        <Card data-testid="rule-proposals">
          <CardHeader>
            <h2 className="text-xl font-semibold">Proposals</h2>
            <p className="mt-1 text-sm text-muted">
              A proposal takes effect once everyone agrees. One no turns it
              down.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {data.proposals.map((p) => (
                <li
                  key={p.id}
                  data-testid={`proposal-${p.id}`}
                  className="flex flex-col gap-2 py-3 text-sm"
                >
                  <p className="text-xs text-subtle">
                    {name(p.proposedBy)}{" "}
                    {p.proposedBy?.id === user?.id ? "propose" : "proposes"}{" "}
                    {what(p)} · {formatDay(p.createdAt)}
                  </p>
                  {p.kind === "change" && p.rule && (
                    <div className="text-subtle">
                      <span className="text-xs">Now:</span>
                      <RuleText
                        title={p.rule.title}
                        details={p.rule.details}
                        struck
                      />
                    </div>
                  )}
                  <div>
                    {p.kind === "change" && (
                      <span className="text-xs text-subtle">Proposed:</span>
                    )}
                    <RuleText
                      title={p.title}
                      details={p.details}
                      struck={p.kind === "remove"}
                    />
                  </div>
                  {p.reason && (
                    <p className="break-words italic text-muted">
                      “{p.reason}”
                    </p>
                  )}
                  <p className="text-xs text-subtle">
                    Agreed: {list(p.agreed)}
                    {p.waitingOn.length > 0 && (
                      <> · Waiting for {list(p.waitingOn)}</>
                    )}
                  </p>

                  {declining?.id === p.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        data-testid="proposal-decline-reason"
                        type="text"
                        value={declining.reason}
                        onChange={(e) =>
                          setDeclining({ id: p.id, reason: e.target.value })
                        }
                        placeholder="Why not? (optional)"
                        aria-label="Why not"
                        maxLength={500}
                        className="w-full sm:flex-1"
                      />
                      <div className="flex gap-2">
                        <Button
                          data-testid="proposal-decline-confirm"
                          variant="danger"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await data.answer(
                                p.id,
                                false,
                                declining.reason.trim() || undefined,
                              );
                              setDeclining(null);
                            })
                          }
                        >
                          Say no
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => setDeclining(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {!p.myAnswer && (
                        <>
                          <Button
                            data-testid="proposal-agree"
                            size="sm"
                            disabled={busy}
                            onClick={() => run(() => data.answer(p.id, true))}
                          >
                            Agree
                          </Button>
                          <Button
                            data-testid="proposal-decline"
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setDeclining({ id: p.id, reason: "" })
                            }
                          >
                            Say no
                          </Button>
                        </>
                      )}
                      {p.canWithdraw && (
                        <Button
                          data-testid="proposal-withdraw"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => run(() => data.withdraw(p.id))}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card data-testid="rules-list">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">House rules</h2>
            <p className="mt-1 text-sm text-muted">
              Rules everyone in {household.name} has agreed to. Adding or
              changing one needs everyone&apos;s agreement.
            </p>
          </div>
          {draft === null && (
            <Button
              data-testid="rule-propose"
              className="shrink-0 self-start"
              onClick={() => setDraft({ kind: "add" })}
            >
              Propose a rule
            </Button>
          )}
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {draft?.kind === "add" && form}

          {data.loading && !data.rules.length ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : data.rules.length === 0 ? (
            <p
              data-testid="rules-empty"
              className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted"
            >
              No rules yet.
              {showStarters &&
                " Propose your own, or start from a common rule below."}
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border-subtle">
              {data.rules.map((r, i) => {
                const pending = proposalFor(r.id);
                return (
                  <li
                    key={r.id}
                    data-testid={`rule-${r.id}`}
                    className="flex flex-col gap-2 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-5 shrink-0 font-semibold text-subtle">
                        {i + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <RuleText title={r.title} details={r.details} />
                        {pending && (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {pending.kind === "change"
                              ? "Change proposed"
                              : "Removal proposed"}
                          </p>
                        )}
                      </div>
                      {!pending && draft === null && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            data-testid={`rule-change-${r.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({ kind: "change", rule: r })
                            }
                          >
                            Change
                          </Button>
                          <Button
                            data-testid={`rule-remove-${r.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({ kind: "remove", rule: r })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                    {draft?.kind !== "add" && draft?.rule.id === r.id && form}
                  </li>
                );
              })}
            </ol>
          )}

          {data.notAgreed.length > 0 && (
            <p data-testid="rules-not-agreed" className="text-xs text-subtle">
              {list(data.notAgreed)}{" "}
              {data.notAgreed.length === 1 ? "hasn't" : "haven't"} agreed to the
              house rules yet.
            </p>
          )}

          <ErrorNote error={actionError ?? data.error} />
        </CardBody>
      </Card>

      {showStarters && (
        <Card data-testid="rule-starters">
          <CardHeader>
            <h2 className="text-xl font-semibold">
              Common rules to start from
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick one to propose it. You can edit it first.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {starters.map((s) => (
                <li
                  key={s.title}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{s.title}</span>
                    <span className="block text-xs text-subtle">
                      {s.details}
                    </span>
                  </span>
                  <Button
                    data-testid="rule-starter"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    disabled={draft !== null}
                    onClick={() => setDraft({ kind: "add", ...s })}
                  >
                    Propose
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {data.history.length > 0 && (
        <Card data-testid="rule-history">
          <CardHeader>
            <h2 className="text-xl font-semibold">Recently decided</h2>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {data.history.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <p className="break-words">
                    <span
                      className={
                        p.status === "adopted"
                          ? "font-medium text-green-700 dark:text-green-500"
                          : "font-medium text-subtle"
                      }
                    >
                      {p.status === "adopted"
                        ? p.kind === "add"
                          ? "Added"
                          : p.kind === "change"
                            ? "Changed"
                            : "Removed"
                        : p.status === "declined"
                          ? "Turned down"
                          : "Withdrawn"}
                      :
                    </span>{" "}
                    {p.title}
                  </p>
                  <p className="text-xs text-subtle">
                    Proposed by {nameMid(p.proposedBy)} ·{" "}
                    {formatDay(p.decidedAt)}
                    {p.declinedBy && (
                      <>
                        {" "}
                        · {name(p.declinedBy.user)} said no
                        {p.declinedBy.reason && <>: “{p.declinedBy.reason}”</>}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
