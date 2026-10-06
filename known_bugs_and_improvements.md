# Known bugs and improvements

Things we know about but haven't fixed or built yet. Add an entry when a bug is found and deliberately deferred, or an improvement is worth remembering; remove it in the same PR that fixes or builds it.

Product decisions and the overall plan live in `CLAUDE.md` ("Current Direction"); this file is for concrete, actionable items.

## Bugs

### Matches page goes back to page 1 on reload

The current page is only kept in the page's memory (`useState`), so reloading — or coming back with the browser's Back button — starts over at page 1. On page 5 you have to click Next four times to get back.

- **Fix:** keep the page number in the URL (`/matches?page=5`), so reload and Back keep your place and a page can be bookmarked or shared.
- **Shortlist:** probably needs the same treatment. It has no pagination today (the whole list shows at once), but check it when fixing this — and anything else on it that resets on reload, like the current selection.

### Invalid input returns 500 instead of 400

Zod validation errors reach the global `errorHandler`, which has no status for them, so bad input (e.g. a room name over 40 characters) comes back as a 500 with a raw validation message. The frontend works around it for room names by checking the length first.

- **Fix:** in `backend/src/middleware/errorHandler.ts`, map `ZodError` to 400 with a readable message.

### A household's only owner can't leave or delete it

Leaving requires another owner, and there's no way to delete a household. Someone who creates a household and is its only member is stuck with it.

- **Fix:** let a sole member leave (deactivating the household), or add "delete household" for the owner.

### Removed household members can rejoin with the join code

`joinByCode` reactivates anyone, including people the owner removed. The owner's only defence today is "New code".

- **Fix:** decide whether removal should block rejoining by code (e.g. only an invite brings them back).

## Improvements

### Chat

- **Invite from the chat room page.** Today invites are only sent from Matches and Shortlist cards. Still to decide: any accepted member (what the backend allows) or the owner only.
- **Show participants and pending invitees in the chat room.** The backend already returns them (`GET /chatrooms/:roomId` → `participants`); the page doesn't display them yet.
- **Remove (kick) a participant from the chat room page.** The backend endpoint exists (`POST /chatrooms/:roomId/kick`); there's no UI for it.
- **Block / reject.** Let users block others so they don't see each other. Also the planned protection against someone being re-invited over and over after declining.

### Matches

- **Add Filters under the nav bar:**
  - Gender
  - Under 50% compatibility
  - On shortlist
  - Seen (after adding a "Seen" checkbox on each card)
  - Age range

### Household

- **Module toggles** (chores, expenses, calendar): add each to `MODULE_TOGGLES` in the owner settings together with its module — they control nothing visible until then. Shopping has its toggle.

### Dev data

- **"me" users after a reset:** `seed-dev.ts` creates `me1`…`me5` before the ~100 Faker users and gives them no compatibility answers, so they sort to the last Matches pages, and the random chat rooms can put them in 3 rooms (which hides them from Matches entirely). Create them after the Faker users, give them some answers, and/or keep them out of seeded rooms.

### Code health

- **Existing lint errors** in the frontend (mostly `catch (err: any)` and `any` types), plus `react-hooks/set-state-in-effect` in a few contexts. New code is kept lint-clean.
- **Dead code:** `frontend/src/components/AppShell.tsx` (unused, links still point at `/matches`) and `authUserToUserLike` in `frontend/src/lib/displayName.ts`.
- **`backend/scripts/seed-dev.ts`** uses `Array.prototype.at()`, which `tsconfig.scripts.json`'s target doesn't allow (`tsc -p tsconfig.scripts.json` reports 2 errors; `tsx` runs it fine).
- **Prisma 7 upgrade** (latest stable 7.x, not the 8.0 release candidate). Mostly touches `createPrisma()`, `tests/setup.ts` (per-worker `datasources` override) and the generator block. Do it on its own branch with the test suite as the safety net.
