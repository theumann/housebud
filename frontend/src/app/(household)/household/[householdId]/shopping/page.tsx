"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { ShoppingList } from "@/components/household/ShoppingList";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function ShoppingPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.shoppingEnabled) {
    return <ModuleOff household={household} moduleName="shopping list" />;
  }

  return <ShoppingList key={household.id} household={household} />;
}
