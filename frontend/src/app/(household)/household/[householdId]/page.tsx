"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { ComingUp } from "@/components/household/ComingUp";
import { HouseholdView } from "@/components/household/HouseholdView";
import { PageHeader } from "@/components/layout/PageHeader";

export default function HouseholdOverviewPage() {
  const { household, reload } = useCurrentHousehold();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={household.name}
        titleTestId="household-name"
        action={
          <span
            data-testid="household-my-role"
            className="mt-1.5 shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
          >
            {household.myRole === "owner" ? "Owner" : "Member"}
          </span>
        }
      />
      <ComingUp key={household.id} household={household} />
      <HouseholdView household={household} onChanged={reload} />
    </div>
  );
}
