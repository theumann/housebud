"use client";

import Link from "next/link";
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
          <div className="flex shrink-0 items-center gap-1">
            <span
              data-testid="household-my-role"
              className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-600/20 dark:text-primary-100"
            >
              {household.myRole === "owner" ? "Owner" : "Member"}
            </span>
            {household.myRole === "owner" && (
              <Link
                href={`/household/${household.id}/settings`}
                data-testid="household-settings-link"
                aria-label="Household settings"
                title="Household settings"
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            )}
          </div>
        }
      />
      <ComingUp key={household.id} household={household} />
      <HouseholdView household={household} onChanged={reload} />
    </div>
  );
}
