"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { setLastSeen } from "@/lib/unread";

type ChatMessage = {
  id: string;
  chatRoomId: string;
  senderUserId: string;
  text: string;
  createdAt: string;
  senderNickname: string | null;
  senderFirstName: string | null;
  senderAvatarUrl: string | null;
};

type ChatRoomInfo = {
  id: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  createdByUserId: string | null;
  myRole: string;
  myStatus: string;
  participantsCount: number;
};

export default function ChatRoomPage() {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [roomInfo, setRoomInfo] = useState<ChatRoomInfo | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [renaming, setRenaming] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Load room details
  useEffect(() => {
    if (!token || !roomId) return;

    const loadRoom = async () => {
      try {
        const info = await apiFetch<ChatRoomInfo>(`/chatrooms/${roomId}`, {
          token,
        });
        setRoomInfo(info);
        setRoomError(null);
      } catch (err: any) {
        setRoomError(err.message || "Failed to load room details");
      }
    };

    loadRoom();
  }, [token, roomId]);
  
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    // When the user opens the room OR messages update while they're viewing it,
    // mark it as read.
    if (!roomId) return;
    setLastSeen(roomId);
  }, [roomId, messages.length]);

  // Load messages + polling
  useEffect(() => {
    if (!token || !roomId) return;

    let cancelled = false;
    let intervalId: NodeJS.Timeout;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await apiFetch<ChatMessage[]>(
          `/chatrooms/${roomId}/messages`,
          { token }
        );
        if (!cancelled) {
          setMessages(data);
          setMessagesError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMessagesError(err.message || "Failed to load messages");
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    // Initial load
    loadMessages();

    // Poll every 3s
    intervalId = setInterval(loadMessages, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token, roomId]);

  const handleRename = async () => {
    if (!token || !roomId || !roomInfo) return;
    if (roomInfo.myRole !== "owner") return;

    const currentName =
      roomInfo.name || `Room #${String(roomInfo.id || roomId).slice(0, 8)}`;

    const name = window.prompt("New room name:", currentName);
    if (name === null) return;

    const trimmed = name.trim();
    if (!trimmed) {
      alert("Room name cannot be empty.");
      return;
    }

    setRenaming(true);
    try {
      await apiFetch<{ message: string }>(`/chatrooms/${roomId}`, {
        method: "PATCH",
        token,
        body: { name: trimmed },
      });
      setRoomInfo((prev) => (prev ? { ...prev, name: trimmed } : prev));
    } catch (err: any) {
      alert(err.message || "Failed to rename room");
    } finally {
      setRenaming(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !roomId) return;
    const text = newMessage.trim();
    if (!text) return;

    setSending(true);
    try {
      const msg = await apiFetch<ChatMessage>(
        `/chatrooms/${roomId}/messages`,
        {
          method: "POST",
          token,
          body: { text },
        }
      );

      // Optimistic append
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setSending(false);
      setLastSeen(roomId);
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

  const roomTitle =
    roomInfo?.name || `Room #${String(roomId).slice(0, 8)}`;

  const isOwner = roomInfo?.myRole === "owner";

  return (
    <PageContainer data-testid="chatroom-page">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{roomTitle}</h1>
              {isOwner && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRename}
                  disabled={renaming}
                  className="text-xs px-2 py-1"
                >
                  {renaming ? "Renaming…" : "Rename"}
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Meet &amp; Greet chat with potential roommates.
              {roomInfo && (
                <>
                  {" "}
                  · Role: {roomInfo.myRole} ·{" "}
                  {roomInfo.participantsCount} participant
                  {roomInfo.participantsCount !== 1 ? "s" : ""}
                  {!roomInfo.isActive && " · Inactive"}
                </>
              )}
            </p>
          </div>
          <Button
            data-testid="back-to-room-list-button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/chatrooms")}
          >
            Back to rooms
          </Button>
        </header>

        {roomError && (
          <div className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {roomError}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden">
          <div data-testid="message-container" className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messagesError && (
              <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {messagesError}
              </div>
            )}

            {loadingMessages && messages.length === 0 && (
              <p className="text-xs text-gray-500">Loading messages…</p>
            )}

            {!loadingMessages && messages.length === 0 && !messagesError && (
              <p className="text-xs text-gray-500">
                No messages yet. Say hi and break the ice.
              </p>
            )}

            {messages.map((msg, index) => {
              const isMine = msg.senderUserId === user.id;
              const created = new Date(msg.createdAt);
              const timeLabel = created.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              const senderName =
                msg.senderNickname ||
                msg.senderFirstName ||
                "Roommate";

              const prev = index > 0 ? messages[index - 1] : null;
              const isFirstFromSender =
                !prev || prev.senderUserId !== msg.senderUserId
              const senderAvatar = msg.senderAvatarUrl;

              return (
                <div
                  key={msg.id}
                  data-testid={`message-row-${msg.id}`}
                  className={clsx(
                    "flex",
                    isMine ? "justify-end" : "justify-start",
                    isFirstFromSender ? "mt-3" : "mt-1"
                  )}
                >
                  <div className="max-w-[75%]">
                    {!isMine && isFirstFromSender && (
                      <div className="mb-0.5 flex items-center gap-2">
                        <div className="h-5 w-5 overflow-hidden rounded-full bg-surface-muted flex items-center justify-center text-[10px] font-semibold text-gray-600">
                          {senderAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={senderAvatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            senderName[0]?.toUpperCase() ?? "?"
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-gray-600">{senderName}</p>
                      </div>
                    )}
                    <div
                      className={clsx(
                        "rounded-2xl px-3 py-2 text-sm shadow-soft",
                        isMine
                          ? "bg-black text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-bl-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {msg.text}
                      </p>
                      <span className="mt-1 block text-[10px] opacity-70 text-right">
                        {isMine ? "You · " : ""}
                        {timeLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            data-testid="send-message-form"
            onSubmit={handleSendMessage}
            className="border-t border-gray-200 px-3 py-2 flex items-end gap-2"
          >
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={2}
              placeholder="Type a message…"
              className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button
              data-testid="send-message-button"
              type="submit"
              variant="primary"
              size="sm"
              disabled={sending || !newMessage.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
