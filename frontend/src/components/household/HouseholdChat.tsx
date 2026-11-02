"use client";

import { useAuth } from "@/context/AuthContext";
import type { Household } from "@/hooks/useHouseholds";
import { useHouseholdChat } from "@/hooks/useHouseholdChat";
import { ModuleOff } from "@/components/household/ModuleOff";
import { MessageThread } from "@/components/chat/MessageThread";
import { getUserDisplayName } from "@/lib/displayName";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFillViewport } from "@/hooks/useFillViewport";

export function HouseholdChat({ household }: { household: Household }) {
  const { user } = useAuth();
  const chat = useHouseholdChat(household.id);
  const [measureChat, chatHeight] = useFillViewport<HTMLDivElement>(24);

  if (chat.unavailable) {
    return <ModuleOff household={household} moduleName="chat" />;
  }

  return (
    <div
      ref={measureChat}
      style={{ height: chatHeight }}
      data-testid="household-chat"
      className="flex flex-col"
    >
      <PageHeader
        className="mb-4"
        title="Chat"
        description={`For everyone in ${household.name}. New members see messages from when they joined.`}
      />
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
