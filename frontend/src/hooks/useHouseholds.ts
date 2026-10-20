"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export type HouseholdMember = {
  id: string;
  userId: string;
  role: "owner" | "member";
  user: {
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

export type HouseholdSettings = {
  chatEnabled: boolean;
  choresEnabled: boolean;
  shoppingEnabled: boolean;
  expensesEnabled: boolean;
  calendarEnabled: boolean;
  rulesEnabled: boolean;
  currency: string;
};

export type Household = {
  id: string;
  name: string;
  joinCode: string;
  myRole: "owner" | "member";
  members: HouseholdMember[];
  settings: HouseholdSettings;
};

// With `pollMs`, also re-fetches quietly on that interval (while the tab is
// visible) and when the window regains focus, so roommates' changes (members,
// settings, name) show up without a reload.
export function useHouseholds(pollMs?: number) {
  const { token } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [householdsError, setHouseholdsError] = useState<string | null>(null);
  // Only the latest request may update the list, so a slow background refresh
  // can't overwrite the result of a change made after it started.
  const requestSeq = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      if (!token) {
        setHouseholds([]);
        setLoadingHouseholds(false);
        return;
      }
      const seq = ++requestSeq.current;
      if (!quiet) {
        setLoadingHouseholds(true);
        setHouseholdsError(null);
      }
      try {
        const data = await apiFetch<Household[]>("/households", { token });
        if (seq !== requestSeq.current) return;
        setHouseholds(data);
        setHouseholdsError(null);
      } catch (err) {
        // A failed background refresh keeps what's on screen.
        if (seq !== requestSeq.current || quiet) return;
        setHouseholdsError(
          err instanceof Error ? err.message : "Failed to load households",
        );
      } finally {
        if (seq === requestSeq.current) setLoadingHouseholds(false);
      }
    },
    [token],
  );

  const reload = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads on mount; reload sets the loading state before fetching
    reload();
  }, [reload]);

  useEffect(() => {
    if (!pollMs || !token) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollMs, token, refresh]);

  const createHousehold = async (name: string) => {
    await apiFetch<Household>("/households", {
      method: "POST",
      token,
      body: { name },
    });
    await reload();
  };

  const joinByCode = async (joinCode: string) => {
    await apiFetch<Household>("/households/join", {
      method: "POST",
      token,
      body: { joinCode },
    });
    await reload();
  };

  return {
    households,
    loadingHouseholds,
    householdsError,
    reload,
    refresh,
    createHousehold,
    joinByCode,
  };
}
