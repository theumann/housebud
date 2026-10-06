"use client";

import { useCallback, useEffect, useState } from "react";
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
  choresEnabled: boolean;
  shoppingEnabled: boolean;
  expensesEnabled: boolean;
  calendarEnabled: boolean;
};

export type Household = {
  id: string;
  name: string;
  joinCode: string;
  myRole: "owner" | "member";
  members: HouseholdMember[];
  settings: HouseholdSettings;
};

export function useHouseholds() {
  const { token } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [householdsError, setHouseholdsError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setHouseholds([]);
      setLoadingHouseholds(false);
      return;
    }
    setLoadingHouseholds(true);
    setHouseholdsError(null);
    try {
      setHouseholds(await apiFetch<Household[]>("/households", { token }));
    } catch (err) {
      setHouseholdsError(
        err instanceof Error ? err.message : "Failed to load households",
      );
    } finally {
      setLoadingHouseholds(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

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
    createHousehold,
    joinByCode,
  };
}
