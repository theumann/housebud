"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";

export type RepeatUnit = "day" | "week" | "month" | "quarter";
export type Repeat = { every: number; unit: RepeatUnit };

// Dates are calendar days ("2026-10-06") with no time zone.
export type Chore = {
  id: string;
  name: string;
  // null: done once.
  repeat: Repeat | null;
  dueDate: string;
  // Turn order: rotation[0] is whose turn it is.
  rotation: string[];
  assigneeUserId: string | null;
  startedAt: string | null;
  startedByUserId: string | null;
};

export type ChoreCompletion = {
  id: string;
  choreId: string;
  choreName: string;
  doneByUserId: string | null;
  dueDate: string;
  completedOn: string;
  // Only a chore's latest completion can be undone.
  undoable: boolean;
};

export type ChoreInput = {
  name: string;
  repeat: Repeat | null;
  dueDate: string;
  rotation: string[];
};

// Today in the user's own time zone, as a calendar day.
export function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useChores(householdId: string, pollMs = 15_000) {
  const { token } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [history, setHistory] = useState<ChoreCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Only the latest request may update the state (see useShoppingList).
  const requestSeq = useRef(0);
  const base = `/households/${householdId}/chores`;

  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    try {
      const [list, done] = await Promise.all([
        apiFetch<Chore[]>(base, { token }),
        apiFetch<ChoreCompletion[]>(`${base}/completions`, { token }),
      ]);
      if (seq !== requestSeq.current) return;
      setChores(list);
      setHistory(done);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load chores");
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

  const send = async (path: string, method: string, body?: object) => {
    requestSeq.current++;
    try {
      await apiFetch(path, { method, token, body });
    } finally {
      await refresh();
    }
  };

  return {
    chores,
    history,
    loading,
    error,
    unavailable,
    createChore: (input: ChoreInput) => send(base, "POST", input),
    updateChore: (choreId: string, input: ChoreInput) =>
      send(`${base}/${choreId}`, "PATCH", input),
    removeChore: (choreId: string) => send(`${base}/${choreId}`, "DELETE"),
    completeChore: (choreId: string) =>
      send(`${base}/${choreId}/complete`, "POST", {
        completedOn: localToday(),
      }),
    startChore: (choreId: string) => send(`${base}/${choreId}/start`, "POST"),
    stopChore: (choreId: string) => send(`${base}/${choreId}/stop`, "POST"),
    undoCompletion: (completionId: string) =>
      send(`${base}/completions/${completionId}/undo`, "POST"),
  };
}
