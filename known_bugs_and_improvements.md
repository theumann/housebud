# Known bugs and improvements

Things we know about but haven't fixed or built yet. Add an entry when a bug is found and deliberately deferred, or an improvement is worth remembering; remove it in the same PR that fixes or builds it.

Product decisions and the overall plan live in `CLAUDE.md` ("Current Direction"); this file is for concrete, actionable items.

## Bugs

### Matches page goes back to page 1 on reload

The current page is only kept in the page's memory (`useState`), so reloading — or coming back with the browser's Back button — starts over at page 1. On page 5 you have to click Next four times to get back.

- **Fix:** keep the page number in the URL (`/matches?page=5`), so reload and Back keep your place and a page can be bookmarked or shared.
- **Shortlist:** probably needs the same treatment. It has no pagination today (the whole list shows at once), but check it when fixing this — and anything else on it that resets on reload, like the current selection.

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
- **Send on Enter, in both chats** (matching rooms and household chat — one change in `components/chat/MessageThread.tsx`). Today Enter adds a new line and only the Send button sends. Decide the new-line key: Shift+Enter is the common convention (Slack, WhatsApp Web, Discord); Ctrl+Enter is the alternative. On phones, keep Enter as a new line, since the on-screen keyboard has no Shift+Enter and people tap Send.
- **Keep the matching chat's unread badge on the server**, like the household chat's (`HouseholdMember.chatReadAt` + `POST …/chat/read`). Today "last seen" is in `localStorage` (`bb:lastSeen:<roomId>`, `lib/unread.ts`). Fix: add a `lastReadAt` to `ChatRoomParticipant` and a read endpoint, and return unread counts with the room list (it already has `latestMessageAt`). Problems with keeping it in the browser:
  - reading on the phone leaves the badge on the laptop;
  - it's per browser, not per user, so two accounts in one browser share it.
- **Block / reject.** Let users block others so they don't see each other. Also the planned protection against someone being re-invited over and over after declining.

### Matches

- **Add Filters under the nav bar:**
  - Gender
  - Under 50% compatibility
  - On shortlist
  - Seen (after adding a "Seen" checkbox on each card)
  - Age range

### Household

- **Household chat: whole history on every page load.** Fine for a few hundred messages; add "load older" (e.g. the latest 100, then `before=`) once households have long histories.
- **Expenses: whole history on every poll.** `GET …/expenses` returns every expense and payment (balances need them all). Fine for a household's first year; page the lists (and maybe cache balances) once they grow.
- **Expenses: owner removing a member** doesn't warn about an open balance the way leaving does. The balance stays visible either way.

### Dev data

- **"me" users after a reset:** `seed-dev.ts` creates `me1`…`me5` before the ~100 Faker users and gives them no compatibility answers, so they sort to the last Matches pages. Create them after the Faker users and/or give them some answers. (They're no longer put in random chat rooms; see the fixed scenarios in `seed-dev.ts`.)
- **Separate seed scripts for Playwright and manual testing.** `seed:e2e` and `seed:users` both run `seed-dev.ts`, so every manual-testing scenario added there is also e2e data, and e2e constraints (me1 in exactly one room, me1/me2 without a household) limit what manual testing can set up.

### Accounts

- **Signup has no rate limit, CAPTCHA or email confirmation.** With `SIGNUP_CODE` set (staging), only people with the code get that far; without it, nothing slows down automated signups and nothing checks that an email is real. Add a rate limit on `/auth/signup` and `/auth/login`, and email confirmation once the app sends email.

- **No password reset in the app.** A forgotten password is reset by hand with `npm run reset-password` (see CLAUDE.md → Deployment), and the user then changes it on the Profile page. Add a reset by email once the app sends email.
- **Changing or resetting a password doesn't log out other sessions.** Tokens can't be revoked: one stays valid for its 7 days whatever happens to the password. Fix: a `tokenVersion` (or `passwordChangedAt`) on `User`, put in the token and checked by `authMiddleware`.

- **Demo sandbox: matching Chat is empty.** The household chat is seeded, but sandbox visitors get no matching chat room: the housemates are seeded demo users who can't log in or accept invites, and putting them in rooms would count toward their 3-room limit and hide them from Matches. A pre-written conversation would need rooms excluded from that limit.

### Look and feel

- **Icons for the nav items** (Matches, Shortlist, Compatibility, Chat, Overview, the household modules). Would also free up room on phones (see "App name in the nav on phones" below).
- **Replace the browser's alert/confirm/prompt boxes and review their wording.** About 20 of them, in the chat room and room list, Matches, Shortlist, `ChoreBoard`, `ExpenseBoard`, `HouseholdView` and `MessageThread`: leaving a chat room, leaving a household, making someone else owner, removing a member, deleting an expense or payment, renaming, forming a household, error messages… They're unstyled and look different in every browser, and the wording needs a review: each confirm should say what will happen (e.g. what someone loses by leaving). Use an in-app confirm dialog, and inline errors where they fit.
- **App name in the nav on phones.** Below `sm` the nav shows the logo icon only, because the row is full. The account menu (`AccountMenu.tsx`) freed about 80px, enough for "Find Roommates" on one line but not for the wordmark (about 115px). To show "HouseBud" there too, shorten "Find Roommates" on small screens (e.g. "Roommates"). (Stacking the name under the icon was considered and rejected: too small, and taller sticky nav.)
- **Per-page browser tab titles** ("Chores · HouseBud"). Every page shows "HouseBud" today. The pages are client components and can't export `metadata`, so this needs a small server `layout.tsx` per section.

### Deployment

- **Migration upgrade test before the first deploy.** Every test run starts from an empty database (all migrations, then seed with current code), so nothing checks that a migration works on data written under the previous schema (a new required column without a default, a rename, a type change). Add a CI job: check out `main`, migrate and seed, switch to the branch, `prisma migrate deploy`, then run the smoke checks (e.g. `household-seed.spec.ts`).

### Code health

- **`react-hooks/set-state-in-effect` is disabled on 4 lines** (`useHouseholds`, `useMyRooms`, `ChatroomsFeedContext`, the compatibility page). Each is a load-on-mount effect whose loader sets loading/error state before its first `await`, which the rule (enforced from `eslint-config-next` 16.4) flags as a cascading render. Not a bug. Fix: move these to a fetching pattern the rule accepts (e.g. derive "loading" from the request instead of setting it in the effect), then drop the disable comments.
- **Dead code:** `authUserToUserLike` in `frontend/src/lib/displayName.ts` is unused.
- **Conflicting classes on shared components.** `Button`, `Input` and friends join their own classes with the caller's using `clsx`, so when both set the same property the winner depends on CSS order, not on which came last. Example: the Shortlist buttons use the `secondary` variant (`border-border-subtle`) and add `border-primary-500`. Fix: merge with `tailwind-merge` in the shared components.
- **`backend/scripts/seed-dev.ts`** uses `Array.prototype.at()`, which `tsconfig.scripts.json`'s target doesn't allow (`tsc -p tsconfig.scripts.json` reports 2 errors; `tsx` runs it fine).
- **npm 11 crashes installing or updating in `backend/`** (`Cannot read properties of null (reading 'edgesOut')`, while resolving `vitest`'s optional peers: vite 8 → `@vitejs/devtools` → vitest 5). npm 12 works: `npx -y npm@12.2.0 install …` / `update <pkg>`. It warns that Node 24.14 is below its supported 24.15, and skips install scripts by default (Prisma, bcrypt, esbuild — already built, so nothing broke; a fresh `node_modules` would need them). Upgrading Node to ≥ 24.15 and npm to 12 fixes it for good.
- **Backend tests push the schema once per test file.** `tests/setup.ts` is a `setupFiles` entry, so its `beforeAll` runs `prisma db push --force-reset` for every file. With parallel workers that pushed past Vitest's 10s hook timeout, so `vitest.config.ts` now sets `hookTimeout: 60_000`. Better: push once per worker schema (e.g. a `globalSetup` that prepares the `test_w*` schemas up front) and keep `resetDb` between tests. That would also make the suite noticeably faster.
- **Upgrade Playwright (1.58).** 1.64.1 is current. Bump `@playwright/test` in `frontend/` and the e2e job's image tag in `ci.yml` (`mcr.microsoft.com/playwright:v<version>-noble`) together: they must match, or the tests can't find their browsers. Run the whole suite on all five projects locally first; new browser builds can change behaviour, so do it on its own branch. Since 2026-10-23 every CI job is pinned to `ubuntu-24.04`, because `ubuntu-latest` became 26.04, where Playwright 1.58 can't install browsers. The e2e jobs bring their own OS in the image now, so the pin can move to a newer runner whenever convenient.
