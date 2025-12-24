"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getLastSeen } from "@/lib/unread";

export type RoomSummary = {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  createdByUserId: string | null;
  role: string;
  status: string;
  participantsCount: number;
  latestMessageAt: string | null;
  latestMessageText: string | null;
};

type ChatroomsResponse = {
  rooms: RoomSummary[];
  invites: RoomSummary[];
};

type ChatroomsFeedValue = {
  rooms: RoomSummary[];
  invites: RoomSummary[];
  pendingInvitesCount: number;
  unreadRoomsCount: number;
  fetching: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ChatroomsFeedContext = createContext<ChatroomsFeedValue | null>(null);

export function ChatroomsFeedProvider({
  children,
  pollMs = 10_000,
}: {
  children: React.ReactNode;
  pollMs?: number;
}) {
  const { token } = useAuth();

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [invites, setInvites] = useState<RoomSummary[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const res = await apiFetch<ChatroomsResponse>("/chatrooms", { token });
      setRooms(res.rooms || []);
      setInvites(res.invites || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load chat rooms");
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    // Reset state when logging out
    if (!token) {
      setRooms([]);
      setInvites([]);
      setFetching(false);
      setError(null);
      return;
    }

    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [token, pollMs, refresh]);

  const pendingInvitesCount = invites.length;

  const unreadRoomsCount = useMemo(() => {
    return rooms.reduce((acc, room) => {
      const lastSeenMs = getLastSeen(room.id);
      const latestMs = room.latestMessageAt ? Date.parse(room.latestMessageAt) : 0;
      return latestMs > lastSeenMs ? acc + 1 : acc;
    }, 0);
  }, [rooms]);

  const value: ChatroomsFeedValue = {
    rooms,
    invites,
    pendingInvitesCount,
    unreadRoomsCount,
    fetching,
    error,
    refresh,
  };

  return (
    <ChatroomsFeedContext.Provider value={value}>
      {children}
    </ChatroomsFeedContext.Provider>
  );
}

export function useChatroomsFeed() {
  const ctx = useContext(ChatroomsFeedContext);
  if (!ctx) {
    throw new Error("useChatroomsFeed must be used within ChatroomsFeedProvider");
  }
  return ctx;
}
