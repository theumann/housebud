"use client";

import { createContext, useContext } from "react";
import type { Household } from "@/hooks/useHouseholds";

type CurrentHouseholdValue = {
  household: Household;
  reload: () => Promise<void>;
};

// Provided by the /household/[householdId] layout once the household has
// loaded; null everywhere else.
export const CurrentHouseholdContext =
  createContext<CurrentHouseholdValue | null>(null);

export function useOptionalCurrentHousehold() {
  return useContext(CurrentHouseholdContext);
}

export function useCurrentHousehold() {
  const ctx = useContext(CurrentHouseholdContext);
  if (!ctx) {
    throw new Error(
      "useCurrentHousehold must be used under /household/[householdId]",
    );
  }
  return ctx;
}
