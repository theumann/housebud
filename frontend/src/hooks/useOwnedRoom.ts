"use client";

import { useEffect, useState } from "react";
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

export function useOwnedRoom() {
  const { token } = useAuth();
  const [ownedRoom, setOwnedRoom] = useState<RoomSummary | null>(null);
  const [loadingOwnedRoom, setLoadingOwnedRoom] = useState(false);
  const [ownedRoomError, setOwnedRoomError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setOwnedRoom(null);
      return;
    }

    const load = async () => {
      setLoadingOwnedRoom(true);
      setOwnedRoomError(null);
      try {
        const res = await apiFetch<ChatroomsResponse>("/chatrooms", { token });
        // Rule: user can own at most 1 active room; we pick owner+accepted+active
        const mine = (res.rooms || []).find(
          (r) =>
            r.role === "owner" &&
            r.status === "accepted" &&
            r.isActive === true,
        );
        setOwnedRoom(mine || null);
      } catch (err: any) {
        setOwnedRoomError(err.message || "Failed to load owned room");
      } finally {
        setLoadingOwnedRoom(false);
      }
    };

    load();
  }, [token]);

  return { ownedRoom, loadingOwnedRoom, ownedRoomError };
}
