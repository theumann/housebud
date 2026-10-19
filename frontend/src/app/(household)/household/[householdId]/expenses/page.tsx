"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { ExpenseBoard } from "@/components/household/ExpenseBoard";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function ExpensesPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.expensesEnabled) {
    return <ModuleOff household={household} moduleName="expense tracker" />;
  }

  return <ExpenseBoard key={household.id} household={household} />;
}
