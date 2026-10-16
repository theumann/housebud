"use client";

import { useCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { HouseholdChat } from "@/components/household/HouseholdChat";
import { ModuleOff } from "@/components/household/ModuleOff";

export default function HouseholdChatPage() {
  const { household } = useCurrentHousehold();

  if (!household.settings.chatEnabled) {
    return <ModuleOff household={household} moduleName="chat" />;
  }

  return <HouseholdChat key={household.id} household={household} />;
}
