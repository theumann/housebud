"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLastSeen } from "@/lib/unread";
import { useChatroomsFeed } from "@/context/ChatroomsFeedContext";

type RoomSummary = {
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

export default function ChatroomsPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { rooms, invites, fetching, error, refresh } = useChatroomsFeed();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const handleInviteAction = async (
    roomId: string,
    action: "accept" | "decline",
  ) => {
    if (!token) return;
    setActionLoadingId(roomId);
    try {
      await apiFetch(`/chatrooms/${roomId}/${action}`, {
        method: "POST",
        token,
      });
      await refresh();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} invite`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeave = async (roomId: string) => {
    if (!token) return;
    setActionLoadingId(roomId);
    try {
      await apiFetch(`/chatrooms/${roomId}/leave`, {
        method: "POST",
        token,
      });
      await refresh();
    } catch (err: any) {
      alert(err.message || "Failed to leave room");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  const hasInvites = invites.length > 0;
  const hasRooms = rooms.length > 0;
  const unreadRoomsCount = rooms.reduce((acc, room) => {
    const lastSeenMs = getLastSeen(room.id);
    const latestMs = room.latestMessageAt
      ? Date.parse(room.latestMessageAt)
      : 0;
    return latestMs > lastSeenMs ? acc + 1 : acc;
  }, 0);

  return (
    <PageContainer data-testid="chatrooms-page">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chat rooms</h1>
          <p className="text-sm text-gray-600">
            Meet &amp; Greet rooms where you can talk with potential roommates.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={fetching}
        >
          {fetching ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pending invites */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Pending invites</h2>
        {!hasInvites && (
          <p className="text-sm text-gray-500">
            No pending invites at the moment.
          </p>
        )}

        {hasInvites && (
          <div className="grid gap-3 md:grid-cols-2">
            {invites.map((room) => (
              <Card key={room.id} data-testid={`invite-room-${room.id}`}>
                <CardHeader data-testid={`invite-room-header-${room.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {room.name ? room.name : `Room #${room.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        You&apos;ve been invited to join this room.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      Invite
                    </span>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-gray-500">
                    Participants: {room.participantsCount}
                  </p>
                  {room.latestMessageAt ? (
                    <p className="mt-2 text-xs text-gray-600">
                      <span className="font-medium">Latest:</span>{" "}
                      {room.latestMessageText
                        ? room.latestMessageText
                        : "Message"}
                      <span className="text-gray-400">
                        {" "}
                        ·{" "}
                        {new Date(room.latestMessageAt).toLocaleString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">
                      No messages yet.
                    </p>
                  )}
                </CardBody>
                <CardFooter>
                  <div className="flex justify-end gap-2">
                    <Button
                      data-testid={`decline-invite-${room.id}`}
                      variant="secondary"
                      size="sm"
                      disabled={actionLoadingId === room.id}
                      onClick={() => handleInviteAction(room.id, "decline")}
                    >
                      {actionLoadingId === room.id ? "..." : "Decline"}
                    </Button>
                    <Button
                      data-testid={`accept-invite-${room.id}`}
                      variant="primary"
                      size="sm"
                      disabled={actionLoadingId === room.id}
                      onClick={() => handleInviteAction(room.id, "accept")}
                    >
                      {actionLoadingId === room.id ? "Accepting…" : "Accept"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Active rooms */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Active rooms</h2>
        {!hasRooms && (
          <p className="text-sm text-gray-500">
            You&apos;re not in any active rooms yet.
          </p>
        )}

        {hasRooms && (
          <div className="grid gap-3 md:grid-cols-2">
            {rooms.map((room) => {
              const isOwner = room.role === "owner";
              const inactiveLabel =
                !room.isActive || room.participantsCount < 2;
              const lastSeenMs = getLastSeen(room.id);
              const latestMs = room.latestMessageAt
                ? Date.parse(room.latestMessageAt)
                : 0;
              const isUnread = latestMs > lastSeenMs;

              return (
                <Card key={room.id} data-testid={`room-card-${room.id}`}>
                  <CardHeader data-testid={`room-card-header-${room.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {room.name
                            ? room.name
                            : `Room #${room.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Role: {room.role} · Status: {room.status}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isUnread && (
                          <button
                            data-testid={`new-message-${room.id}`}
                            type="button"
                            onClick={() => router.push(`/chatrooms/${room.id}`)}
                            className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-500 cursor-pointer"
                            aria-label="Open chat"
                          >
                            New
                          </button>
                        )}
                        {isOwner && (
                          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
                            Owner
                          </span>
                        )}
                        {inactiveLabel && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <p className="text-xs text-gray-500">
                      Participants: {room.participantsCount}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created:{" "}
                      {new Date(room.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </CardBody>
                  <CardFooter>
                    <div className="flex justify-between gap-2">
                      <Button
                        data-testid={`open-chat-${room.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/chatrooms/${room.id}`)}
                      >
                        Open chat
                      </Button>
                      <Button
                        data-testid={`leave-chat-room-${room.id}`}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        disabled={actionLoadingId === room.id}
                        onClick={() => handleLeave(room.id)}
                      >
                        {actionLoadingId === room.id ? "Leaving…" : "Leave"}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {fetching && (
        <p className="mt-4 text-xs text-gray-500">Refreshing chat rooms…</p>
      )}
    </PageContainer>
  );
}
