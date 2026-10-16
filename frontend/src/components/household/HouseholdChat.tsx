"use client";

import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import { useHouseholdChat } from "@/hooks/useHouseholdChat";
import { ModuleOff } from "@/components/household/ModuleOff";
import { MessageThread } from "@/components/chat/MessageThread";
import { getUserDisplayName } from "@/lib/displayName";

export function HouseholdChat({ household }: { household: Household }) {
  const { user } = useAuth();
  const chat = useHouseholdChat(household.id);

  if (chat.unavailable) {
    return <ModuleOff household={household} moduleName="chat" />;
  }

  return (
    <div
      data-testid="household-chat"
      className="flex h-[calc(100dvh-220px)] min-h-80 flex-col"
    >
      <header className="mb-3">
        <h1 className="text-xl font-bold">{household.name} chat</h1>
        <p className="text-xs text-subtle">
          For everyone in the household. New members see messages from when they
          joined.
        </p>
      </header>
      <MessageThread
        messages={chat.messages.map((m) => ({
          id: m.id,
          senderUserId: m.sender.id,
          senderName: getUserDisplayName(m.sender),
          senderAvatarUrl: m.sender.profile?.avatarUrl ?? null,
          text: m.text,
          createdAt: m.createdAt,
        }))}
        currentUserId={user?.id ?? ""}
        loading={chat.loading}
        error={chat.error}
        emptyText="No messages yet. Start the house conversation."
        onSend={chat.send}
      />
    </div>
  );
}
