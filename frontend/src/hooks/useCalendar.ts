"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import { localToday, type Repeat } from "@/hooks/useChores";

export type CalendarUser = {
  id: string;
  username: string;
  profile: {
    displayName: string | null;
    firstName: string;
    lastName: string;
  } | null;
};

export type EntryKind = "event" | "away" | "guest";

// One day of an entry. Dates are calendar days and times the house's clock
// time ("19:00"), with no time zone.
export type Occurrence = {
  date: string;
  kind: EntryKind | "chore";
  // The entry's id, or the chore's.
  id: string;
  // The guest for a guest entry; null for away entries.
  title: string | null;
  notes: string | null;
  startTime: string | null;
  endTime: string | null;
  // The whole entry's days, for "day 2 of 3".
  startsOn: string;
  endsOn: string;
  repeat: Repeat | null;
  // Who an away/guest entry is about, or whose turn a chore is.
  user: CalendarUser | null;
  createdBy: CalendarUser | null;
  canEdit: boolean;
  overdue: boolean;
};

export type EntryInput =
  | {
      kind: "event";
      title: string;
      notes?: string;
      startsOn: string;
      endsOn?: string;
      startTime?: string;
      endTime?: string;
      repeat: Repeat | null;
    }
  | {
      kind: "away" | "guest";
      userId?: string;
      title?: string;
      notes?: string;
      startsOn: string;
      endsOn?: string;
    };

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Occurrences between two days (inclusive), refreshed every `pollMs`.
export function useCalendar(
  householdId: string,
  from: string,
  to: string,
  pollMs = 60_000,
) {
  const { token } = useAuth();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  // The range the occurrences are for, so a new range shows "Loading".
  const [loadedRange, setLoadedRange] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Only the latest request may update the state (see useShoppingList).
  const requestSeq = useRef(0);
  const base = `/households/${householdId}/calendar`;
  const range = `${from}..${to}`;

  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    const query = new URLSearchParams({ from, to, today: localToday() });
    try {
      const data = await apiFetch<{ occurrences: Occurrence[] }>(
        `${base}?${query}`,
        { token },
      );
      if (seq !== requestSeq.current) return;
      setOccurrences(data.occurrences);
      setLoadedRange(`${from}..${to}`);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load the calendar",
        );
      }
    }
  }, [token, base, from, to]);

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

  const send = async (
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: unknown,
  ) => {
    requestSeq.current++;
    try {
      await apiFetch(`${base}${path}`, { method, token, body });
    } finally {
      await refresh();
    }
  };

  return {
    occurrences,
    loading: loadedRange !== range,
    error,
    unavailable,
    create: (input: EntryInput) => send("/events", "POST", input),
    update: (id: string, input: EntryInput) =>
      send(`/events/${id}`, "PUT", input),
    remove: (id: string) => send(`/events/${id}`, "DELETE"),
    skip: (id: string, date: string) =>
      send(`/events/${id}/skip`, "POST", { date }),
  };
}
