"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

type RoomSummary = {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  createdByUserId: string | null;
  role: string;
  status: string;
  participantsCount: number;
};

type ChatroomsResponse = {
  rooms: RoomSummary[];
  invites: RoomSummary[];
};

type Participant = { userId: string; role: string; status: string };

type RoomWithParticipants = RoomSummary & { participants: Participant[] };

// "pending" | "accepted" | "declined" | "left" | "removed", or null when the
// user has never been added to the room.
export type ParticipantStatus = string | null;

// The active rooms the current user is an accepted member of (at most 3), with
// their participants: which room they own, and which rooms they share with
// another user.
export function useMyRooms() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<RoomWithParticipants[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadingRooms(true);
    setRoomsError(null);
    try {
      const res = await apiFetch<ChatroomsResponse>("/chatrooms", { token });
      const mine = (res.rooms || []).filter(
        (r) => r.status === "accepted" && r.isActive,
      );
      const withParticipants = await Promise.all(
        mine.map(async (room) => {
          const details = await apiFetch<{ participants: Participant[] }>(
            `/chatrooms/${room.id}`,
            { token },
          );
          return { ...room, participants: details.participants };
        }),
      );
      setRooms(withParticipants);
    } catch (err) {
      setRoomsError(
        err instanceof Error ? err.message : "Failed to load your rooms",
      );
    } finally {
      setLoadingRooms(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRooms = token ? rooms : [];
  // Rule: user can own at most 1 active room
  const ownedRoom = visibleRooms.find((r) => r.role === "owner") ?? null;

  const participantStatus = (userId: string): ParticipantStatus =>
    ownedRoom?.participants.find((p) => p.userId === userId)?.status ?? null;

  // A room where both the current user and `userId` are accepted members.
  const sharedRoom = (userId: string) =>
    visibleRooms.find((r) =>
      r.participants.some(
        (p) => p.userId === userId && p.status === "accepted",
      ),
    ) ?? null;

  const invite = async (userIds: string[]) => {
    if (!ownedRoom) return;
    await apiFetch<{ message: string }>(`/chatrooms/${ownedRoom.id}/invite`, {
      method: "POST",
      token,
      body: { participantIds: userIds },
    });
    await load();
  };

  return {
    ownedRoom,
    sharedRoom,
    participantStatus,
    invite,
    loadingRooms,
    roomsError,
  };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Invited",
  declined: "Declined",
  left: "Left the room",
  removed: "Removed",
};

// Label for a disabled invite button when the user can't be invited to the
// owned room; null means they can. Accepted members get a "Chat in …" link
// instead (see sharedRoom), so they have no label here.
export function inviteStatusLabel(status: ParticipantStatus): string | null {
  if (!status || status === "accepted") return null;
  return STATUS_LABEL[status] ?? status;
}
