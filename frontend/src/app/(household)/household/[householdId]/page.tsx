"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { ComingUp } from "@/components/household/ComingUp";
import { HouseholdView } from "@/components/household/HouseholdView";

export default function HouseholdOverviewPage() {
  const { household, reload } = useCurrentHousehold();

  return (
    <div className="flex flex-col gap-4">
      <ComingUp key={household.id} household={household} />
      <HouseholdView household={household} onChanged={reload} />
    </div>
  );
}
