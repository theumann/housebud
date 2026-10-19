"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import { localToday } from "@/hooks/useChores";
import {
  type Expense,
  type ExpenseInput,
  formatMoney,
  parseMoney,
} from "@/hooks/useExpenses";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { getUserDisplayName } from "@/lib/displayName";

export function ExpenseForm({
  household,
  currency,
  expense,
  initialDescription = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  household: Household;
  currency: string;
  // Editing this expense; otherwise a new one.
  expense?: Expense;
  initialDescription?: string;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const members = household.members;
  const [description, setDescription] = useState(
    expense?.description ?? initialDescription,
  );
  const [amount, setAmount] = useState(
    expense ? (expense.amountCents / 100).toFixed(2) : "",
  );
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? localToday());
  const [paidByUserId, setPaidByUserId] = useState(
    expense?.paidBy.id ?? user?.id ?? members[0]?.userId ?? "",
  );
  const [splitWith, setSplitWith] = useState<string[]>(
    expense?.shares.map((s) => s.user.id) ?? members.map((m) => m.userId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = parseMoney(amount);
  // People on the expense who have since left stay selectable while editing.
  const people = [
    ...members.map((m) => ({ id: m.userId, user: m.user, former: false })),
    ...(expense ? [expense.paidBy, ...expense.shares.map((s) => s.user)] : [])
      .filter(
        (u, i, all) =>
          !members.some((m) => m.userId === u.id) &&
          all.findIndex((v) => v.id === u.id) === i,
      )
      .map((u) => ({ id: u.id, user: u, former: true })),
  ];

  const toggle = (userId: string, on: boolean) =>
    setSplitWith((ids) =>
      on ? [...ids, userId] : ids.filter((id) => id !== userId),
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amountCents || splitWith.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        description: description.trim(),
        amountCents,
        paidByUserId,
        spentOn,
        splitWith,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <form
      data-testid="expense-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          data-testid="expense-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for? e.g. Groceries"
          aria-label="Description"
          maxLength={200}
          required
          className="w-full sm:flex-1"
        />
        <Input
          data-testid="expense-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount (${currency})`}
          aria-label="Amount"
          required
          className="w-full sm:w-36"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Paid by
          <Select
            data-testid="expense-paid-by"
            value={paidByUserId}
            onChange={(e) => setPaidByUserId(e.target.value)}
            className="w-full"
          >
            {people
              .filter((p) => !p.former || p.id === paidByUserId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === user?.id ? "Me" : getUserDisplayName(p.user)}
                </option>
              ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:w-44">
          Date
          <Input
            data-testid="expense-date"
            type="date"
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
            required
            className="w-full"
          />
        </label>
      </div>
      <fieldset className="text-sm">
        <legend className="mb-1">Split equally between</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                data-testid={`expense-split-${p.id}`}
                type="checkbox"
                checked={splitWith.includes(p.id)}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              {p.id === user?.id ? "Me" : getUserDisplayName(p.user)}
              {p.former && <span className="text-subtle">(left)</span>}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-subtle">
          {splitWith.length === 0
            ? "Pick at least one person."
            : amountCents
              ? `${amountCents % splitWith.length ? "about " : ""}${formatMoney(Math.floor(amountCents / splitWith.length), currency)} each`
              : `${splitWith.length} ${splitWith.length === 1 ? "person" : "people"}`}
        </p>
      </fieldset>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          data-testid="expense-submit"
          type="submit"
          disabled={
            saving ||
            !description.trim() ||
            !amountCents ||
            splitWith.length === 0
          }
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
