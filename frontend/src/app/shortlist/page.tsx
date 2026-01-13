"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useShortlist } from "@/context/ShortlistContext";
import { apiFetch } from "@/lib/api";
import { useOwnedRoom } from "@/hooks/useOwnedRoom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getUserDisplayName, shortlistedUserToUserLike} from "@/lib/displayName";

function EmptyShortlistState() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface shadow-soft p-6">
      <h2 className="text-base font-semibold">Your shortlist is empty</h2>
      <p className="mt-1 text-sm text-gray-600">
        Add a few promising roommates from Matches, then start a Meet &amp; Greet chat.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href="/matches"
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
        >
          Browse matches
        </a>
        <a
          href="/compatibility"
          className="inline-flex items-center justify-center rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-gray-900 hover:bg-surface-muted"
        >
          Improve compatibility
        </a>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Tip: Shortlist is private — other users aren’t notified until you invite them to chat.
      </p>
    </div>
  );
}

export default function ShortlistPage() {
  const { user, token, loading } = useAuth();
  const { shortlist, remove, clear } = useShortlist();
  const { ownedRoom } = useOwnedRoom();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

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
        : [...prev, userId]
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
      "Room name (optional – leave empty for no name):"
    );

    if (name === null) {
      // user cancelled
      return;
    }

    const trimmed = name.trim();

    setCreating(true);
    setError(null);
    try {
      const body: any = {
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
    } catch (err: any) {
      setError(err.message || "Failed to create chat room");
    } finally {
      setCreating(false);
    }
  };

  const handleInviteSelectedToOwnedRoom = async () => {
    if (!token || !ownedRoom) return;
    if (selectedIds.length === 0) {
      setError("Select at least one roommate to invite.");
      return;
    }

    setInviting(true);
    setError(null);
    try {
      await apiFetch<{ message: string }>(
        `/chatrooms/${ownedRoom.id}/invite`,
        {
          method: "POST",
          token,
          body: {
            participantIds: selectedIds,
          },
        }
      );

      alert(
        `Invites sent to ${selectedIds.length} roommate(s) for room "${
          ownedRoom.name || `Room #${ownedRoom.id.slice(0, 8)}`
        }".`
      );
    } catch (err: any) {
      setError(err.message || "Failed to invite selected roommates");
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
          <p className="text-sm text-gray-600">
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

      {!hasShortlist && <EmptyShortlistState />}

      {hasShortlist && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shortlist.map((u) => {
              const displayName = getUserDisplayName(
                shortlistedUserToUserLike(u)
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
                          <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-muted flex items-center justify-center text-sm font-semibold">
                            {u.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              (displayName[0]?.toUpperCase() ?? "?")
                            )}
                          </div>
                          <div>
                            <h2 className="text-base font-semibold">
                              {displayName}
                            </h2>
                            <p className="text-xs text-gray-600">
                              {u.age !== null ? `${u.age} · ` : ""}
                              {u.school} · {u.collegeYear}
                            </p>
                            <p className="text-xs text-gray-500">
                              {u.targetCity}, {u.targetState} {u.targetZip}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardBody>
                    {u.bio && (
                      <p className="mt-1 text-xs text-gray-700 line-clamp-3">
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
                      {selected && (
                        <span className="text-green-700 font-medium">
                          Selected
                        </span>
                      )}
                    </div>
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
                    <span className="text-gray-500"> · </span>
                    <button
                      data-testid="clear-selection-button"
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900"
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
                      {creating ? "Creating…" : "Start chat"}
                    </Button>

                    {ownedRoom && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleInviteSelectedToOwnedRoom}
                        disabled={inviting}
                        className="border-blue-500 text-blue-700 hover:bg-blue-50"
                      >
                        {inviting
                          ? "Inviting…"
                          : `Invite to "${ownedRoom.name || `Room #${ownedRoom.id.slice(0, 8)}`}"`}
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
              {creating ? "Creating chat room…" : "Start new chat with selected"}
            </Button>

            {ownedRoom && (
              <Button
                data-testid="invite-selected-to-owned-room-button"
                variant="secondary"
                size="sm"
                onClick={handleInviteSelectedToOwnedRoom}
                disabled={inviting || selectedIds.length === 0}
                className="border-blue-500 text-blue-700 hover:bg-blue-50"
              >
                {inviting
                  ? "Inviting to your room…"
                  : `Invite selected to "${
                      ownedRoom.name ||
                      `Room #${ownedRoom.id.slice(0, 8)}`
                    }"`}
              </Button>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}