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
    error: string | null;
  }>({ token: null, invites: [], error: null });

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const invites = await apiFetch<HouseholdInvite[]>(
        "/households/invites/mine",
        { token },
      );
      setState({ token, invites, error: null });
    } catch (err) {
      setState((prev) => ({
        token,
        invites: prev.token === token ? prev.invites : [],
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
