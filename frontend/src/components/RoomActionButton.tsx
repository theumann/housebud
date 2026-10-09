"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  canInvite,
  inviteStatusLabel,
  type useMyRooms,
} from "@/hooks/useMyRooms";
import { roomDisplayName } from "@/lib/rooms";

type MyRooms = ReturnType<typeof useMyRooms>;

// On a user's card: "Chat in <room>" when you already share a room with them,
// otherwise the invite button for the room you own (if any).
export function RoomActionButton({
  userId,
  myRooms,
  inviting,
  onInvite,
}: {
  userId: string;
  myRooms: MyRooms;
  inviting: boolean;
  onInvite?: (userId: string) => void;
}) {
  const router = useRouter();
  const { sharedRoom, ownedRoom, participantStatus } = myRooms;

  const shared = sharedRoom(userId);
  if (shared) {
    const label = `Chat in ${roomDisplayName(shared)}`;
    return (
      <Button
        data-testid={`chat-in-room-button-${userId}`}
        variant="ghost"
        size="sm"
        title={label}
        className="mt-1 w-full min-w-0 border border-primary-500 text-primary-700 hover:bg-primary-50 dark:text-primary-500 dark:hover:bg-primary-600/20"
        onClick={() => router.push(`/chatrooms/${shared.id}`)}
      >
        <span className="truncate">{label}</span>
      </Button>
    );
  }

  if (!ownedRoom || !onInvite) return null;

  const status = participantStatus(userId);
  const invitable = canInvite(status);
  const statusLabel = inviteStatusLabel(status);
  const label = inviting
    ? "Inviting..."
    : !invitable
      ? (statusLabel ?? "")
      : statusLabel
        ? `${statusLabel} · Invite again`
        : `Invite to ${roomDisplayName(ownedRoom)}`;

  return (
    <Button
      data-testid={`invite-to-room-button-${userId}`}
      variant="ghost"
      size="sm"
      title={label}
      className="mt-1 w-full min-w-0 border border-primary-500 text-primary-700 hover:bg-primary-50 dark:text-primary-500 dark:hover:bg-primary-600/20"
      disabled={!invitable || inviting}
      onClick={() => onInvite(userId)}
    >
      <span className="truncate">{label}</span>
    </Button>
  );
}
