export function getLastSeen(roomId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`bb:lastSeen:${roomId}`);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function setLastSeen(roomId: string, atMs: number = Date.now()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`bb:lastSeen:${roomId}`, String(atMs));
}

