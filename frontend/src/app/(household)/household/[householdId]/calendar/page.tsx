"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { HouseholdCalendar } from "@/components/household/HouseholdCalendar";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function CalendarPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.calendarEnabled) {
    return <ModuleOff household={household} moduleName="calendar" />;
  }

  return <HouseholdCalendar key={household.id} household={household} />;
}
