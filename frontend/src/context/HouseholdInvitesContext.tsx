"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type HouseholdInvite = {
  id: string;
  expiresAt: string;
  createdAt: string;
  household: { id: string; name: string };
  invitedByUser: {
    id: string;
    username: string;
    profile: { displayName: string | null; firstName: string } | null;
  } | null;
};

type HouseholdInvitesValue = {
  invites: HouseholdInvite[];
  // Unread household chat messages per household id, for the nav badges.
  unreadMessages: Record<string, number>;
  // Rule proposals waiting for my answer (+1 if I still need to agree to the
  // rules) per household id.
  pendingRules: Record<string, number>;
  error: string | null;
  refresh: () => Promise<void>;
  accept: (inviteId: string) => Promise<void>;
  decline: (inviteId: string) => Promise<void>;
};

const HouseholdInvitesContext = createContext<HouseholdInvitesValue | null>(
  null,
);

export function HouseholdInvitesProvider({
  children,
  pollMs = 30_000,
}: {
  children: React.ReactNode;
  pollMs?: number;
}) {
  const { token } = useAuth();
  // Results are tagged with the token they were fetched for, so another
  // user's invites never show after a logout/login in the same tab.
  const [state, setState] = useState<{
    token: string | null;
    invites: HouseholdInvite[];
    unreadMessages: Record<string, number>;
    pendingRules: Record<string, number>;
    error: string | null;
  }>({
    token: null,
    invites: [],
    unreadMessages: {},
    pendingRules: {},
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [invites, households] = await Promise.all([
        apiFetch<HouseholdInvite[]>("/households/invites/mine", { token }),
        apiFetch<
          { id: string; unreadMessages: number; pendingRules: number }[]
        >("/households", { token }),
      ]);
      setState({
        token,
        invites,
        unreadMessages: Object.fromEntries(
          households.map((h) => [h.id, h.unreadMessages]),
        ),
        pendingRules: Object.fromEntries(
          households.map((h) => [h.id, h.pendingRules]),
        ),
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        token,
        invites: prev.token === token ? prev.invites : [],
        unreadMessages: prev.token === token ? prev.unreadMessages : {},
        pendingRules: prev.token === token ? prev.pendingRules : {},
        error: err instanceof Error ? err.message : "Failed to load invites",
      }));
    }
  }, [token]);

  const current = state.token === token;

  useEffect(() => {
    if (!token) return;

    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [token, pollMs, refresh]);

  const respond = async (inviteId: string, action: "accept" | "decline") => {
    await apiFetch(`/households/invites/${inviteId}/${action}`, {
      method: "POST",
      token,
    });
    await refresh();
  };

  const value: HouseholdInvitesValue = {
    invites: current ? state.invites : [],
    unreadMessages: current ? state.unreadMessages : {},
    pendingRules: current ? state.pendingRules : {},
    error: current ? state.error : null,
    refresh,
    accept: (inviteId) => respond(inviteId, "accept"),
    decline: (inviteId) => respond(inviteId, "decline"),
  };

  return (
    <HouseholdInvitesContext.Provider value={value}>
      {children}
    </HouseholdInvitesContext.Provider>
  );
}

export function useHouseholdInvites() {
  const ctx = useContext(HouseholdInvitesContext);
  if (!ctx) {
    throw new Error(
      "useHouseholdInvites must be used within HouseholdInvitesProvider",
    );
  }
  return ctx;
}
