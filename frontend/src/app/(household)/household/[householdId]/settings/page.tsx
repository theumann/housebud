"use client";

import Link from "next/link";
import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { HouseholdSettingsView } from "@/components/household/HouseholdView";
import { PageHeader } from "@/components/layout/PageHeader";

export default function HouseholdSettingsPage() {
  const { household, reload } = useCurrentHousehold();

  return (
    <div className="flex flex-col gap-4">
      {/* A link, not history.back(): Settings can be opened from its address,
          and an app added to an iPhone's home screen has no back button. */}
      <Link
        href={`/household/${household.id}`}
        data-testid="household-settings-back"
        className="-mb-2 self-start text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        <span aria-hidden="true">← </span>Overview
      </Link>
      <PageHeader
        title="Household settings"
        description="Name, features and currency"
      />
      <HouseholdSettingsView household={household} onChanged={reload} />
    </div>
  );
}
