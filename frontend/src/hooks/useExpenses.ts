"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";

export type ExpenseUser = {
  id: string;
  username: string;
  profile: {
    displayName: string | null;
    firstName: string;
    lastName: string;
  } | null;
};

export type Expense = {
  id: string;
  description: string;
  amountCents: number;
  spentOn: string;
  paidBy: ExpenseUser;
  createdBy: ExpenseUser | null;
  shares: { user: ExpenseUser; amountCents: number }[];
  canEdit: boolean;
};

export type Settlement = {
  id: string;
  from: ExpenseUser;
  to: ExpenseUser;
  amountCents: number;
  paidOn: string;
  createdBy: ExpenseUser | null;
  canEdit: boolean;
};

export type Balance = {
  user: ExpenseUser;
  status: "active" | "left" | "removed";
  // Positive: the others owe them; negative: they owe.
  netCents: number;
};

export type Transfer = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

type Overview = {
  currency: string;
  expenses: Expense[];
  settlements: Settlement[];
  balances: Balance[];
  transfers: Transfer[];
};

export type ExpenseInput = {
  description: string;
  amountCents: number;
  paidByUserId: string;
  spentOn: string;
  splitWith: string[];
  shoppingItemIds?: string[];
};

export type SettlementInput = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  paidOn: string;
};

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

// "12.5" or "12,50" → 1250; null when it isn't a positive amount.
export function parseMoney(text: string) {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 ? cents : null;
}

export function useExpenses(householdId: string, pollMs = 15_000) {
  const { token } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 404: the module was turned off (or we lost access) since the page loaded.
  const [unavailable, setUnavailable] = useState(false);
  // Only the latest request may update the data, so a slow poll can't undo a
  // change made after it started.
  const requestSeq = useRef(0);
  const base = `/households/${householdId}/expenses`;

  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    try {
      const data = await apiFetch<Overview>(base, { token });
      if (seq !== requestSeq.current) return;
      setOverview(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load expenses",
        );
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, base]);

  useEffect(() => {
    if (!token) return;
    const seqRef = requestSeq;
    const first = window.setTimeout(refresh, 0);
    const id = window.setInterval(refresh, pollMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      seqRef.current++;
    };
  }, [token, pollMs, refresh]);

  const send = async (path: string, method: string, body?: unknown) => {
    requestSeq.current++;
    try {
      await apiFetch(`${base}${path}`, { method, token, body });
    } finally {
      await refresh();
    }
  };

  return {
    currency: overview?.currency ?? "USD",
    expenses: overview?.expenses ?? [],
    settlements: overview?.settlements ?? [],
    balances: overview?.balances ?? [],
    transfers: overview?.transfers ?? [],
    loading,
    error,
    unavailable,
    addExpense: (input: ExpenseInput) => send("/expenses", "POST", input),
    updateExpense: (id: string, input: Partial<ExpenseInput>) =>
      send(`/expenses/${id}`, "PATCH", input),
    deleteExpense: (id: string) => send(`/expenses/${id}`, "DELETE"),
    addSettlement: (input: SettlementInput) =>
      send("/settlements", "POST", input),
    deleteSettlement: (id: string) => send(`/settlements/${id}`, "DELETE"),
  };
}
