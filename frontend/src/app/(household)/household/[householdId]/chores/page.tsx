"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { ChoreBoard } from "@/components/household/ChoreBoard";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function ChoresPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.choresEnabled) {
    return <ModuleOff household={household} moduleName="chore list" />;
  }

  return <ChoreBoard key={household.id} household={household} />;
}
