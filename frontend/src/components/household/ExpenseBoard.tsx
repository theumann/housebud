"use client";

import { FormEvent, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import { localToday } from "@/hooks/useChores";
import {
  type Balance,
  type ExpenseUser,
  formatMoney,
  parseMoney,
  useExpenses,
} from "@/hooks/useExpenses";
import { ModuleOff } from "@/components/household/ModuleOff";
import { ExpenseForm } from "@/components/household/ExpenseForm";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { getUserDisplayName } from "@/lib/displayName";

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
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

function PaymentForm({
  balances,
  currency,
  onSubmit,
  onCancel,
}: {
  balances: Balance[];
  currency: string;
  onSubmit: (input: {
    fromUserId: string;
    toUserId: string;
    amountCents: number;
    paidOn: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const people = balances.map((b) => b.user);
  const [fromUserId, setFromUserId] = useState(user?.id ?? people[0]?.id ?? "");
  const [toUserId, setToUserId] = useState(
    people.find((p) => p.id !== fromUserId)?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountCents = parseMoney(amount);

  const name = (p: ExpenseUser) =>
    p.id === user?.id ? "Me" : getUserDisplayName(p);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amountCents) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        fromUserId,
        toUserId,
        amountCents,
        paidOn: localToday(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <form
      data-testid="payment-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
        <Select
          data-testid="payment-from"
          value={fromUserId}
          onChange={(e) => setFromUserId(e.target.value)}
          aria-label="Who paid"
          className="w-full sm:flex-1"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {name(p)}
            </option>
          ))}
        </Select>
        <span className="text-muted">paid</span>
        <Select
          data-testid="payment-to"
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          aria-label="Who received it"
          className="w-full sm:flex-1"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {name(p)}
            </option>
          ))}
        </Select>
        <Input
          data-testid="payment-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount (${currency})`}
          aria-label="Amount"
          className="w-full sm:w-32"
        />
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button
          data-testid="payment-submit"
          type="submit"
          disabled={saving || !amountCents || fromUserId === toUserId}
        >
          {saving ? "Saving…" : "Record payment"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ExpenseBoard({ household }: { household: Household }) {
  const { user } = useAuth();
  const data = useExpenses(household.id);
  // "new", an expense id being edited, "payment", or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set for a moment after "Mark as paid": the list shifts up, and a second
  // click would otherwise land on the next transfer.
  const [justPaid, setJustPaid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (data.unavailable) {
    return <ModuleOff household={household} moduleName="expense tracker" />;
  }

  const { currency } = data;
  const money = (cents: number) => formatMoney(cents, currency);
  const users = new Map(data.balances.map((b) => [b.user.id, b.user]));
  const name = (u: ExpenseUser | undefined) =>
    !u ? "Former member" : u.id === user?.id ? "You" : getUserDisplayName(u);
  // The same, in the middle of a sentence.
  const nameMid = (u: ExpenseUser | undefined) =>
    u && u.id === user?.id ? "you" : name(u);

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

  const markPaid = (t: (typeof data.transfers)[number]) =>
    run(async () => {
      await data.addSettlement({ ...t, paidOn: localToday() });
      setJustPaid(true);
      window.setTimeout(() => setJustPaid(false), 1000);
    });

  const confirmDelete = (what: string, fn: () => Promise<void>) => {
    if (window.confirm(`Delete ${what}? Everyone's balances will change.`)) {
      run(fn);
    }
  };

  const editingExpense = data.expenses.find((e) => e.id === editing);

  return (
    <div className="flex flex-col gap-4">
      <Card data-testid="expenses-dues">
        <CardHeader>
          <h2 className="text-xl font-semibold">Dues</h2>
          <p className="mt-1 text-sm text-muted">
            Who owes what across all expenses in {household.name}.
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {data.loading && !data.balances.length ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <>
              <ul className="divide-y divide-border-subtle">
                {data.balances.map((b) => (
                  <li
                    key={b.user.id}
                    data-testid={`balance-${b.user.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span>
                      {name(b.user)}
                      {b.status !== "active" && (
                        <span className="text-subtle"> (former member)</span>
                      )}
                    </span>
                    <span
                      data-testid="balance-amount"
                      className={clsx(
                        b.netCents > 0 && "text-green-700 dark:text-green-500",
                        b.netCents < 0 && "text-red-700 dark:text-red-400",
                        b.netCents === 0 && "text-subtle",
                      )}
                    >
                      {b.netCents === 0
                        ? "Settled up"
                        : b.netCents > 0
                          ? `${b.user.id === user?.id ? "are" : "is"} owed ${money(b.netCents)}`
                          : `${b.user.id === user?.id ? "owe" : "owes"} ${money(-b.netCents)}`}
                    </span>
                  </li>
                ))}
              </ul>

              {data.transfers.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">To settle up</h3>
                  <ul
                    data-testid="transfers"
                    className="divide-y divide-border-subtle"
                  >
                    {data.transfers.map((t) => (
                      <li
                        key={`${t.fromUserId}-${t.toUserId}`}
                        data-testid="transfer"
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span>
                          {name(users.get(t.fromUserId))}{" "}
                          {t.fromUserId === user?.id ? "pay" : "pays"}{" "}
                          {nameMid(users.get(t.toUserId))}{" "}
                          <strong>{money(t.amountCents)}</strong>
                        </span>
                        <Button
                          data-testid="transfer-mark-paid"
                          variant="secondary"
                          size="sm"
                          disabled={busy || justPaid}
                          onClick={() => markPaid(t)}
                        >
                          Mark as paid
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {editing === "payment" ? (
                <PaymentForm
                  balances={data.balances}
                  currency={currency}
                  onSubmit={async (input) => {
                    await data.addSettlement(input);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div>
                  <Button
                    data-testid="payment-new"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing("payment")}
                  >
                    Record a payment
                  </Button>
                </div>
              )}
            </>
          )}
          <ErrorNote error={actionError ?? data.error} />
        </CardBody>
      </Card>

      <Card data-testid="expenses-list">
        <CardHeader className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Expenses</h2>
          {editing !== "new" && (
            <Button data-testid="expense-new" onClick={() => setEditing("new")}>
              Add expense
            </Button>
          )}
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {editing === "new" && (
            <ExpenseForm
              household={household}
              currency={currency}
              submitLabel="Add expense"
              onSubmit={async (input) => {
                await data.addExpense(input);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          {!data.loading && data.expenses.length === 0 && editing !== "new" && (
            <p data-testid="expenses-empty" className="text-sm text-subtle">
              No expenses yet.
            </p>
          )}

          <ul className="divide-y divide-border-subtle">
            {data.expenses.map((e) =>
              editingExpense?.id === e.id ? (
                <li key={e.id} className="py-3">
                  <ExpenseForm
                    household={household}
                    currency={currency}
                    expense={e}
                    submitLabel="Save"
                    onSubmit={async (input) => {
                      await data.updateExpense(e.id, input);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li
                  key={e.id}
                  data-testid={`expense-${e.id}`}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{e.description}</p>
                    <p className="text-xs text-subtle">
                      {name(e.paidBy)} paid · {formatDay(e.spentOn)}
                      {e.createdBy &&
                        e.createdBy.id !== e.paidBy.id &&
                        ` · added by ${nameMid(e.createdBy)}`}{" "}
                      · split between{" "}
                      {e.shares.length === household.members.length &&
                      household.members.every((m) =>
                        e.shares.some((s) => s.user.id === m.userId),
                      )
                        ? "everyone"
                        : e.shares.map((s) => nameMid(s.user)).join(", ")}
                    </p>
                    {e.shares.some((s) => s.user.id === user?.id) && (
                      <p className="text-xs text-subtle">
                        Your share:{" "}
                        {money(
                          e.shares.find((s) => s.user.id === user?.id)!
                            .amountCents,
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      data-testid="expense-amount-shown"
                      className="font-semibold"
                    >
                      {money(e.amountCents)}
                    </span>
                    {e.canEdit && (
                      <div className="flex gap-1">
                        <Button
                          data-testid={`expense-edit-${e.id}`}
                          variant="ghost"
                          size="sm"
                          disabled={busy || editing !== null}
                          onClick={() => setEditing(e.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          data-testid={`expense-delete-${e.id}`}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          disabled={busy}
                          onClick={() =>
                            confirmDelete(
                              `"${e.description}" (${money(e.amountCents)})`,
                              () => data.deleteExpense(e.id),
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        </CardBody>
      </Card>

      {data.settlements.length > 0 && (
        <Card data-testid="payments-list">
          <CardHeader>
            <h2 className="text-xl font-semibold">Payments</h2>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-border-subtle">
              {data.settlements.map((s) => (
                <li
                  key={s.id}
                  data-testid={`payment-${s.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {name(s.from)} paid {nameMid(s.to)}{" "}
                    <strong>{money(s.amountCents)}</strong>
                    <span className="text-xs text-subtle">
                      {" "}
                      · {formatDay(s.paidOn)}
                    </span>
                  </span>
                  {s.canEdit && (
                    <Button
                      data-testid={`payment-delete-${s.id}`}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() =>
                        confirmDelete(
                          `the payment of ${money(s.amountCents)} from ${nameMid(s.from)} to ${nameMid(s.to)}`,
                          () => data.deleteSettlement(s.id),
                        )
                      }
                    >
                      Delete
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
