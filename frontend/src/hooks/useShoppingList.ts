"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";

type ItemUser = {
  id: string;
  username: string;
  profile: {
    displayName: string | null;
    firstName: string;
    lastName: string;
  } | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  createdAt: string;
  checkedAt: string | null;
  addedByUser: ItemUser | null;
  checkedByUser: ItemUser | null;
};

// Polls the list so roommates' changes show up. Checking and removing update
// the list right away, then re-sync with the server.
export function useShoppingList(householdId: string, pollMs = 10_000) {
  const { token } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 404: the module was turned off (or we lost access) since the page loaded.
  const [unavailable, setUnavailable] = useState(false);
  // Only the latest request may update the list, so a slow poll can't undo a
  // change made after it started.
  const requestSeq = useRef(0);
  const base = `/households/${householdId}/shopping`;

  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    try {
      const data = await apiFetch<ShoppingItem[]>(`${base}/items`, { token });
      if (seq !== requestSeq.current) return;
      setItems(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load list");
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

  const mutate = async (
    update: (items: ShoppingItem[]) => ShoppingItem[],
    request: () => Promise<unknown>,
  ) => {
    requestSeq.current++;
    setItems(update);
    try {
      await request();
    } finally {
      await refresh();
    }
  };

  return {
    items,
    loading,
    error,
    unavailable,
    addItem: async (name: string, quantity: string) => {
      await apiFetch(`${base}/items`, {
        method: "POST",
        token,
        body: { name, quantity },
      });
      await refresh();
    },
    setChecked: (itemId: string, checked: boolean) =>
      mutate(
        (list) =>
          list.map((i) =>
            i.id === itemId
              ? { ...i, checkedAt: checked ? new Date().toISOString() : null }
              : i,
          ),
        () =>
          apiFetch(`${base}/items/${itemId}`, {
            method: "PATCH",
            token,
            body: { checked },
          }),
      ),
    removeItem: (itemId: string) =>
      mutate(
        (list) => list.filter((i) => i.id !== itemId),
        () => apiFetch(`${base}/items/${itemId}`, { method: "DELETE", token }),
      ),
    clearChecked: () =>
      mutate(
        (list) => list.filter((i) => !i.checkedAt),
        () => apiFetch(`${base}/clear-checked`, { method: "POST", token }),
      ),
  };
}
