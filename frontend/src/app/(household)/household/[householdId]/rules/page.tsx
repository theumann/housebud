"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { HouseRules } from "@/components/household/HouseRules";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function RulesPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.rulesEnabled) {
    return <ModuleOff household={household} moduleName="house rules page" />;
  }

  return <HouseRules key={household.id} household={household} />;
}
