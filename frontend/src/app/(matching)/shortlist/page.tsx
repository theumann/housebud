"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useShortlist } from "@/context/ShortlistContext";
import { apiFetch } from "@/lib/api";
import { useMyRooms, inviteStatusLabel, canInvite } from "@/hooks/useMyRooms";
import { RoomActionButton } from "@/components/RoomActionButton";
import { roomDisplayName, roomNameError } from "@/lib/rooms";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  getUserDisplayName,
  shortlistedUserToUserLike,
} from "@/lib/displayName";
import { Avatar } from "@/components/ui/Avatar";

function EmptyShortlistState() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface shadow-soft p-6">
      <h2 className="text-base font-semibold">Your shortlist is empty</h2>
      <p className="mt-1 text-sm text-muted">
        Add a few promising roommates from Matches, then start a Meet &amp;
        Greet chat.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href="/matches"
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Browse matches
        </a>
        <a
          href="/compatibility"
          className="inline-flex items-center justify-center rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Improve compatibility
        </a>
      </div>

      <p className="mt-4 text-xs text-subtle">
        Tip: Shortlist is private — other users aren’t notified until you invite
        them to chat.
      </p>
    </div>
  );
}

export default function ShortlistPage() {
  const { user, token, loading } = useAuth();
  const { shortlist, remove, clear } = useShortlist();
  const myRooms = useMyRooms();
  const { ownedRoom, participantStatus, invite } = myRooms;
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  if (!user) return null;

  const toggleSelected = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
    setError(null);
  };

  const handleStartChat = async () => {
    if (!token) return;
    if (selectedIds.length === 0) {
      setError("Select at least one roommate to start a chat.");
      return;
    }

    const name = window.prompt(
      "Room name (optional – leave empty for no name):",
    );

    if (name === null) {
      // user cancelled
      return;
    }

    const trimmed = name.trim();
    const nameError = roomNameError(trimmed);
    if (nameError) {
      setError(nameError);
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const body: { participantIds: string[]; name?: string } = {
        participantIds: selectedIds,
      };
      if (trimmed.length > 0) {
        body.name = trimmed;
      }

      const res = await apiFetch<{ roomId: string }>("/chatrooms", {
        method: "POST",
        token,
        body,
      });

      router.push(`/chatrooms/${res.roomId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create chat room",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleInviteSelectedToOwnedRoom = async () => {
    if (!ownedRoom) return;
    if (selectedIds.length === 0) {
      setError("Select at least one roommate to invite.");
      return;
    }

    // People already invited or in the room are skipped by the backend anyway;
    // only send the ones that can actually be (re-)invited.
    const invitable = selectedIds.filter((id) =>
      canInvite(participantStatus(id)),
    );
    if (invitable.length === 0) {
      setError("Everyone selected is already invited to or in your room.");
      return;
    }

    setInviting(true);
    setError(null);
    setNotice(null);
    try {
      await invite(invitable);
      setSelectedIds([]);
      setNotice(
        `Invited ${invitable.length} roommate${invitable.length === 1 ? "" : "s"} to ${roomDisplayName(ownedRoom)}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to invite selected roommates",
      );
    } finally {
      setInviting(false);
    }
  };

  const hasShortlist = shortlist.length > 0;

  return (
    <PageContainer data-testid="shortlist-page">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shortlist</h1>
          <p className="text-sm text-muted">
            Keep track of promising roommates and start or extend chats from
            here.
          </p>
        </div>
        {hasShortlist && (
          <Button
            data-testid="clear-shortlist-button"
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              clear();
              setSelectedIds([]);
              setError(null);
            }}
          >
            Clear all
          </Button>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div
          data-testid="shortlist-invite-notice"
          className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {!hasShortlist && <EmptyShortlistState />}

      {hasShortlist && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shortlist.map((u) => {
              const displayName = getUserDisplayName(
                shortlistedUserToUserLike(u),
              );
              const selected = selectedIds.includes(u.userId);
              return (
                <Card key={u.userId} data-testid={`shortlist-card-${u.userId}`}>
                  <CardHeader data-testid={`shortlist-card-header-${u.userId}`}>
                    <div className="flex items-start gap-3">
                      <input
                        data-testid={`shortlist-checkbox-${u.userId}`}
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(u.userId)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Avatar
                            userId={u.userId}
                            name={displayName}
                            avatarUrl={u.avatarUrl}
                          />
                          <div>
                            <h2 className="text-base font-semibold">
                              {displayName}
                            </h2>
                            <p className="text-xs text-muted">
                              {u.age !== null ? `${u.age} · ` : ""}
                              {u.school} · {u.collegeYear}
                            </p>
                            <p className="text-xs text-subtle">
                              {u.targetCity}, {u.targetState} {u.targetZip}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardBody>
                    {u.bio && (
                      <p className="mt-1 text-xs text-foreground-soft line-clamp-3">
                        {u.bio}
                      </p>
                    )}
                  </CardBody>

                  <CardFooter>
                    <div className="flex items-center justify-between text-xs">
                      <Button
                        data-testid={`shortlist-remove-button-${u.userId}`}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 px-0"
                        onClick={() => remove(u.userId)}
                      >
                        Remove
                      </Button>
                      {ownedRoom &&
                        inviteStatusLabel(participantStatus(u.userId)) && (
                          <span
                            data-testid={`shortlist-room-status-${u.userId}`}
                            className="text-subtle"
                          >
                            {inviteStatusLabel(participantStatus(u.userId))}
                          </span>
                        )}
                      {selected && (
                        <span className="text-green-700 font-medium">
                          Selected
                        </span>
                      )}
                    </div>
                    <RoomActionButton
                      userId={u.userId}
                      myRooms={myRooms}
                      inviting={false}
                    />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div className="sticky bottom-3 z-20 mt-4">
              <div className="rounded-card border border-border-subtle bg-surface shadow-soft px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <span className="font-semibold">{selectedIds.length}</span>{" "}
                    selected
                    <span className="text-subtle"> · </span>
                    <button
                      data-testid="clear-selection-button"
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
                    >
                      Clear selection
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      data-testid="start-chat-button"
                      variant="primary"
                      size="sm"
                      onClick={handleStartChat}
                      disabled={creating}
                    >
                      {creating ? "Creating…" : "New chat"}
                    </Button>

                    {ownedRoom && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleInviteSelectedToOwnedRoom}
                        disabled={inviting}
                        title={`Invite to ${roomDisplayName(ownedRoom)}`}
                        className="min-w-0 max-w-xs border-primary-500 text-primary-700 hover:bg-primary-50 dark:text-primary-500 dark:hover:bg-primary-600/20"
                      >
                        <span className="truncate">
                          {inviting
                            ? "Inviting…"
                            : `Invite to ${roomDisplayName(ownedRoom)}`}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartChat}
              disabled={creating || selectedIds.length === 0}
            >
              {creating ? "Creating chat room…" : "New chat with selected"}
            </Button>

            {ownedRoom && (
              <Button
                data-testid="invite-selected-to-owned-room-button"
                variant="secondary"
                size="sm"
                onClick={handleInviteSelectedToOwnedRoom}
                disabled={inviting || selectedIds.length === 0}
                title={`Invite selected to ${roomDisplayName(ownedRoom)}`}
                className="min-w-0 border-primary-500 text-primary-700 hover:bg-primary-50 dark:text-primary-500 dark:hover:bg-primary-600/20"
              >
                <span className="truncate">
                  {inviting
                    ? "Inviting to your room…"
                    : `Invite selected to ${roomDisplayName(ownedRoom)}`}
                </span>
              </Button>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
