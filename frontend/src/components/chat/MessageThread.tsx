"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";

export type ThreadMessage = {
  id: string;
  senderUserId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  text: string;
  createdAt: string;
};

// Message list + composer shared by matching chat rooms and household chat.
// `onSend` throws to keep the draft (the caller shows the error).
export function MessageThread({
  messages,
  currentUserId,
  loading,
  error,
  emptyText,
  onSend,
}: {
  messages: ThreadMessage[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  emptyText: string;
  onSend: (text: string) => Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Scrolls the list only; scrollIntoView would also scroll the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;

    setSending(true);
    try {
      await onSend(text);
      setNewMessage("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 rounded-xl border border-border-subtle bg-surface flex flex-col overflow-hidden">
      <div
        ref={listRef}
        data-testid="message-container"
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
      >
        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading && messages.length === 0 && (
          <p className="text-xs text-subtle">Loading messages…</p>
        )}

        {!loading && messages.length === 0 && !error && (
          <p data-testid="message-thread-empty" className="text-xs text-subtle">
            {emptyText}
          </p>
        )}

        {messages.map((msg, index) => {
          const isMine = msg.senderUserId === currentUserId;
          const timeLabel = new Date(msg.createdAt).toLocaleTimeString(
            undefined,
            { hour: "2-digit", minute: "2-digit" },
          );

          const prev = index > 0 ? messages[index - 1] : null;
          const isFirstFromSender =
            !prev || prev.senderUserId !== msg.senderUserId;

          return (
            <div
              key={msg.id}
              data-testid={`message-row-${msg.id}`}
              className={clsx(
                "flex",
                isMine ? "justify-end" : "justify-start",
                isFirstFromSender ? "mt-3" : "mt-1",
              )}
            >
              <div className="max-w-[75%]">
                {!isMine && isFirstFromSender && (
                  <div className="mb-0.5 flex items-center gap-2">
                    <Avatar
                      userId={msg.senderUserId}
                      name={msg.senderName}
                      avatarUrl={msg.senderAvatarUrl}
                      size="xs"
                    />
                    <p className="text-[11px] font-medium text-muted">
                      {msg.senderName}
                    </p>
                  </div>
                )}
                <div
                  className={clsx(
                    "rounded-2xl px-3 py-2 text-sm shadow-soft",
                    isMine
                      ? "bg-gray-600 text-white rounded-br-sm"
                      : "bg-surface-muted text-foreground rounded-bl-sm",
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
      </div>

      <form
        data-testid="send-message-form"
        onSubmit={handleSubmit}
        className="border-t border-border-subtle px-3 py-2 flex items-end gap-2"
      >
        <Textarea
          data-testid="message-input"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={2}
          placeholder="Type a message…"
          className="flex-1 resize-none"
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
  );
}
