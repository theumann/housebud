"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";

export type HouseholdMessage = {
  id: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    profile: {
      displayName: string | null;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    } | null;
  };
};

function merge(list: HouseholdMessage[], incoming: HouseholdMessage[]) {
  const known = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  if (!added.length) return list;
  // A poll that started before a send can land after it; keep time order.
  return [...list, ...added].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

// Loads the whole history once, then polls for messages from the newest one
// on (the server includes that one, so ids already shown are skipped).
export function useHouseholdChat(householdId: string, pollMs = 3_000) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<HouseholdMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 404: the module was turned off (or we lost access) since the page loaded.
  const [unavailable, setUnavailable] = useState(false);
  const newestAt = useRef<string | null>(null);
  const base = `/households/${householdId}/chat`;

  const receive = useCallback((incoming: HouseholdMessage[]) => {
    for (const m of incoming) {
      if (!newestAt.current || m.createdAt > newestAt.current) {
        newestAt.current = m.createdAt;
      }
    }
    setMessages((list) => merge(list, incoming));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const query = newestAt.current
      ? `?after=${encodeURIComponent(newestAt.current)}`
      : "";
    try {
      const data = await apiFetch<HouseholdMessage[]>(
        `${base}/messages${query}`,
        { token },
      );
      receive(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, base, receive]);

  useEffect(() => {
    if (!token) return;
    const first = window.setTimeout(refresh, 0);
    const id = window.setInterval(refresh, pollMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [token, pollMs, refresh]);

  return {
    messages,
    loading,
    error,
    unavailable,
    send: async (text: string) => {
      const msg = await apiFetch<HouseholdMessage>(`${base}/messages`, {
        method: "POST",
        token,
        body: { text },
      });
      receive([msg]);
    },
  };
}
