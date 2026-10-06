"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { HouseholdView } from "@/components/household/HouseholdView";

export default function HouseholdOverviewPage() {
  const { household, reload } = useCurrentHousehold();

  return <HouseholdView household={household} onChanged={reload} />;
}
