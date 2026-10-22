"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { HouseRule, ProposalInput } from "@/hooks/useHouseRules";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

// What the form proposes: a new rule (optionally prefilled from a starter),
// or a change to or the removal of an existing one.
export type ProposalDraft =
  | { kind: "add"; title?: string; details?: string }
  | { kind: "change" | "remove"; rule: HouseRule };

type Starter = { title: string; details: string };

export function RuleProposalForm({
  draft,
  starters = [],
  onSubmit,
  onCancel,
}: {
  draft: ProposalDraft;
  // Common rules a new rule can start from.
  starters?: Starter[];
  onSubmit: (input: ProposalInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initial =
    draft.kind === "add"
      ? { title: draft.title ?? "", details: draft.details ?? "" }
      : { title: draft.rule.title, details: draft.rule.details ?? "" };
  const [title, setTitle] = useState(initial.title);
  const [details, setDetails] = useState(initial.details);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startersOpen, setStartersOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // A starter picked further down the page opens the form out of sight.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const pickStarter = (s: Starter) => {
    setTitle(s.title);
    setDetails(s.details);
    setStartersOpen(false);
  };

  const unchanged =
    draft.kind === "change" &&
    title.trim() === initial.title &&
    details.trim() === initial.details;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const why = reason.trim() || undefined;
    try {
      await onSubmit(
        draft.kind === "remove"
          ? { kind: "remove", ruleId: draft.rule.id, reason: why }
          : draft.kind === "change"
            ? {
                kind: "change",
                ruleId: draft.rule.id,
                title: title.trim(),
                details: details.trim(),
                reason: why,
              }
            : {
                kind: "add",
                title: title.trim(),
                details: details.trim(),
                reason: why,
              },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <form
      ref={formRef}
      data-testid="rule-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-muted p-3"
    >
      <p className="text-sm font-semibold">
        {draft.kind === "add"
          ? "Propose a new rule"
          : draft.kind === "change"
            ? "Propose a change"
            : "Propose removing this rule"}
      </p>
      {draft.kind === "add" && starters.length > 0 && (
        <details
          data-testid="rule-form-starters"
          open={startersOpen}
          onToggle={(e) => setStartersOpen(e.currentTarget.open)}
          className="rounded-md border border-border-subtle bg-surface text-sm"
        >
          <summary className="cursor-pointer px-3 py-2 font-medium text-primary-700 dark:text-primary-400">
            Start from a common rule{" "}
            <span className="font-normal text-subtle">(optional)</span>
          </summary>
          <ul className="flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
            {starters.map((s) => (
              <li key={s.title}>
                <button
                  type="button"
                  data-testid="rule-form-starter"
                  onClick={() => pickStarter(s)}
                  className="w-full px-3 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-xs text-subtle">{s.details}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {draft.kind === "remove" ? (
        <p className="text-sm">
          <span className="line-through">{draft.rule.title}</span>
        </p>
      ) : (
        <>
          <Input
            data-testid="rule-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The rule, e.g. Quiet hours after 11pm"
            aria-label="Rule"
            maxLength={120}
            required
            className="w-full"
          />
          <Textarea
            data-testid="rule-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Details (optional)"
            aria-label="Details"
            maxLength={1000}
            rows={2}
            className="w-full"
          />
        </>
      )}
      <Input
        data-testid="rule-reason"
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why? (optional)"
        aria-label="Why"
        maxLength={500}
        className="w-full"
      />
      <p className="text-xs text-subtle">
        It takes effect once everyone in the household agrees.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          data-testid="rule-submit"
          type="submit"
          disabled={
            saving || (draft.kind !== "remove" && !title.trim()) || unchanged
          }
        >
          {saving ? "Proposing…" : "Propose"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
