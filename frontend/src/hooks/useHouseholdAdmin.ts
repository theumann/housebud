"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { Household, HouseholdSettings } from "@/hooks/useHouseholds";

export type SentInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

// Actions on one household. Owner-only actions are rejected by the backend
// for members; the UI only offers them to the owner. `onChanged` reloads the
// household list so names, codes, members and roles stay current.
export function useHouseholdAdmin(
  household: Household,
  onChanged: () => Promise<void>,
) {
  const { token } = useAuth();
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const isOwner = household.myRole === "owner";
  const base = `/households/${household.id}`;

  const fetchSentInvites = useCallback(
    () => apiFetch<SentInvite[]>(`${base}/invites`, { token }),
    [token, base],
  );

  const loadSentInvites = async () => {
    setSentInvites(await fetchSentInvites());
  };

  useEffect(() => {
    if (!token || !isOwner) return;
    let cancelled = false;
    fetchSentInvites()
      .then((invites) => {
        if (!cancelled) setSentInvites(invites);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, isOwner, fetchSentInvites]);

  const call = (path: string, method: string, body?: object) =>
    apiFetch(path, { method, token, body });

  return {
    sentInvites: isOwner ? sentInvites : [],
    rename: async (name: string) => {
      await call(base, "PATCH", { name });
      await onChanged();
    },
    updateSettings: async (settings: Partial<HouseholdSettings>) => {
      await call(`${base}/settings`, "PATCH", settings);
      await onChanged();
    },
    regenerateJoinCode: async () => {
      await call(`${base}/join-code`, "POST");
      await onChanged();
    },
    inviteByEmail: async (email: string) => {
      await call(`${base}/invites`, "POST", { email });
      await loadSentInvites();
    },
    revokeInvite: async (inviteId: string) => {
      await call(`${base}/invites/${inviteId}`, "DELETE");
      await loadSentInvites();
    },
    removeMember: async (userId: string) => {
      await call(`${base}/members/${userId}`, "DELETE");
      await onChanged();
    },
    makeOwner: async (userId: string) => {
      await call(`${base}/members/${userId}/owner`, "POST");
      await onChanged();
    },
    leave: async () => {
      await call(`${base}/leave`, "POST");
      await onChanged();
    },
  };
}
