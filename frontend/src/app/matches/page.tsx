"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useShortlist } from "@/context/ShortlistContext";
import { useOwnedRoom } from "@/hooks/useOwnedRoom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function MatchCardSkeleton() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface shadow-soft p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-surface-muted animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-32 rounded bg-surface-muted animate-pulse" />
          <div className="mt-2 h-3 w-24 rounded bg-surface-muted animate-pulse" />
        </div>
        <div className="h-8 w-20 rounded bg-surface-muted animate-pulse" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-3 w-3/4 rounded bg-surface-muted animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-surface-muted animate-pulse" />
      </div>
    </div>
  );
}

function EmptyMatchesState() {
  return (
    <div className="rounded-card border border-border-subtle bg-surface shadow-soft p-6">
      <h2 className="text-base font-semibold">No matches yet</h2>
      <p className="mt-1 text-sm text-gray-600">
        We’re not finding anyone in your target ZIP area right now.
        Try widening your target ZIP, or answer more compatibility questions to
        improve match sorting.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href="/profile"
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
        >
          Update target ZIP
        </a>
        <a
          href="/compatibility"
          className="inline-flex items-center justify-center rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-gray-900 hover:bg-surface-muted"
        >
          Answer compatibility questions
        </a>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Note: Some matches may also be in your shortlist (and hidden here).
      </p>
    </div>
  );
}

type MatchItem = {
  userId: string;
  nickname: string;
  age: number | null;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  score: number | null; // 0–100 or null
  coverage: number; // 0–1
  hasMinCompatData: boolean;
};

type MatchesResponse = {
  items: MatchItem[];
  page: number;
  total: number;
};

export default function MatchesPage() {
  const { user, token, loading } = useAuth();
  const { shortlist, add, remove, isShortlisted } = useShortlist();
  const { ownedRoom } = useOwnedRoom();
  const router = useRouter();

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const pageSize = matches.length || 10; // fallback if empty
  const isFirstPage = page <= 1;
  const isLastPage = total > 0 && page * pageSize >= total;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    const fetchMatches = async () => {
      setFetching(true);
      setError(null);
      try {
        const res = await apiFetch<MatchesResponse>(`/matches?page=${page}`, {
          token,
        });
        setMatches(res.items);
        setTotal(res.total);
      } catch (err: any) {
        setError(err.message || "Failed to load matches");
      } finally {
        setFetching(false);
      }
    };

    fetchMatches();
  }, [token, page]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  const hasMatches = matches.length > 0;

  const handleStartChatWithUser = async (userId: string, nickname: string) => {
    if (!token) return;

    const name = window.prompt(
      "Room name (optional - leave empty for default):",
    );

    if (name === null) {
      // user cancelled
      return;
    }

    const trimmedName = name.trim();
    const body: any = {
      participantIds: [userId],
    };
    if (trimmedName.length > 0) {
      body.name = trimmedName;
    }

    try {
      const res = await apiFetch<{ roomId: string }>("/chatrooms", {
        method: "POST",
        token,
        body,
      });
      router.push(`/chatrooms/${res.roomId}`);
    } catch (err: any) {
      alert(err.message || "Failed to create chat room");
    }
  };

  const handleInviteToOwnedRoom = async (
    userId: string,
    nickname: string
  ) => {
    if (!token || !ownedRoom) return;

    setInvitingUserId(userId);
    try {
      await apiFetch<{ message: string }>(
        `/chatrooms/${ownedRoom.id}/invite`,
        {
          method: "POST",
          token,
          body: {
            participantIds: [userId],
          },
        }
      );
      alert(
        `Invite sent to ${nickname || "this user"} for room "${
          ownedRoom.name || `Room #${ownedRoom.id.slice(0, 8)}`
        }".`
      );
    } catch (err: any) {
      alert(err.message || "Failed to invite user to room");
    } finally {
      setInvitingUserId(null);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <p>Loading...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer data-testid="matches-page">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Matches</h1>
          <p className="text-sm text-gray-600">
            Potential roommates near your target location, sorted by compatibility.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-gray-600">
            Logged in as <strong>{user.email}</strong>
          </span>
          <a href="/compatibility" data-testid="improve-compatibility-link" className="text-blue-600 underline">
            Improve compatibility
          </a>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {fetching && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
        ))}
        </div>
      )}

      {!hasMatches && !fetching && !error && (
        <EmptyMatchesState />
      )}

      {hasMatches && !fetching && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"  >
          {matches.map((m) => {
            const shortlisted = isShortlisted(m.userId);
            const compatPercent = (m.coverage * 100).toFixed(0);

            return (
              <Card key={m.userId} data-testid={`match-card-header-${m.userId}`}>
                <CardHeader>
                  <div data-testid={`match-card-header-${m.userId}`} className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-muted flex items-center justify-center text-sm font-semibold">
                       {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (m.nickname?.[0]?.toUpperCase() ?? "?")
                  )}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">
                        {m.nickname || "Roommate"}
                      </h2>
                      <p className="text-xs text-gray-600">
                        {m.age !== null ? `${m.age} · ` : ""}
                        {m.school} · {m.collegeYear}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.targetCity}, {m.targetState} {m.targetZip}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardBody>
                  {m.bio && (
                    <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                      {m.bio}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="text-gray-500">Match score</p>
                      {m.score !== null ? (
                        <p className="font-semibold">{m.score} / 100</p>
                      ) : (
                        <p className="text-gray-400">Not enough data yet</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">Compat coverage</p>
                      <p className="text-xs">
                        {compatPercent}%{" "}
                        {!m.hasMinCompatData && (
                          <span className="text-yellow-700">
                            (low response rate)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardBody>

                <CardFooter>
                  <div className="flex gap-2">
                    <Button
                      variant={shortlisted ? "secondary" : "secondary"}
                      size="sm"
                      data-testid={
                        shortlisted ? `shortlist-remove-button-${m.userId}` : `shortlist-add-button-${m.userId}`}
                      className={
                        shortlisted ? "border-green-500 text-green-700" : ""
                      }
                      onClick={() => {
                        if (shortlisted) {
                          remove(m.userId);
                        } else {
                          add({
                            userId: m.userId,
                            nickname: m.nickname,
                            age: m.age,
                            school: m.school,
                            collegeYear: m.collegeYear,
                            targetCity: m.targetCity,
                            targetState: m.targetState,
                            targetZip: m.targetZip,
                            bio: m.bio,
                            avatarUrl: m.avatarUrl,
                          });
                        }
                      }}
                    >
                      {shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                    </Button>
                    <Button
                      data-testid={`start-chat-button-${m.userId}`}
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        handleStartChatWithUser(m.userId, m.nickname)
                      }
                    >
                      Start chat
                    </Button>
                  </div>

                  {ownedRoom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full border border-blue-500 text-blue-700 hover:bg-blue-50 mt-1"
                      disabled={invitingUserId === m.userId}
                      onClick={() =>
                        handleInviteToOwnedRoom(m.userId, m.nickname)
                      }
                    >
                      {invitingUserId === m.userId
                        ? "Inviting..."
                        : `Invite to "${
                            ownedRoom.name ||
                            `Room #${ownedRoom.id.slice(0, 8)}`
                          }"`}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-3">
          {hasMatches && (
            <span>
                Page <strong>{page}</strong>
                {total > 0 && (
                  <>
                    {" "}
                    of <strong>{Math.max(1, Math.ceil(total / pageSize))}</strong>
                  </>
                )}
                {total > 0 && <> · total {total}</>}
            </span>
          )}
          {shortlist.length > 0 && (
            <span>
              Shortlisted: <strong>{shortlist.length}</strong>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="previous-button"
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isFirstPage || fetching}
          >
            {fetching ? "Loading…" : "Previous"}
          </Button>
          <Button
            data-testid="next-button"
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={fetching || !hasMatches || isLastPage}
          >
            {fetching ? "Loading…" : "Next"}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
