// Must match ROOM_NAME_MAX in backend/src/modules/chat/chat.types.ts.
export const ROOM_NAME_MAX = 40;

export function roomDisplayName(room: { id: string; name: string | null }) {
  return room.name || `Room #${room.id.slice(0, 8)}`;
}

// Returns an error message, or null when the name is acceptable.
export function roomNameError(name: string): string | null {
  return name.length > ROOM_NAME_MAX
    ? `Room names can be at most ${ROOM_NAME_MAX} characters.`
    : null;
}
