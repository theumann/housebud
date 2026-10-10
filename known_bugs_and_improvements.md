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
- **Block / reject.** Let users block others so they don't see each other. Also the planned protection against someone being re-invited over and over after declining.

### Matches

- **Add Filters under the nav bar:**
  - Gender
  - Under 50% compatibility
  - On shortlist
  - Seen (after adding a "Seen" checkbox on each card)
  - Age range

### Household

- **Module toggles** (expenses, calendar): add each to `MODULE_TOGGLES` in the owner settings together with its module — they control nothing visible until then. Chores and shopping have theirs.

### Dev data

- **"me" users after a reset:** `seed-dev.ts` creates `me1`…`me5` before the ~100 Faker users and gives them no compatibility answers, so they sort to the last Matches pages. Create them after the Faker users and/or give them some answers. (They're no longer put in random chat rooms; see the fixed scenarios in `seed-dev.ts`.)
- **Separate seed scripts for Playwright and manual testing.** `seed:e2e` and `seed:users` both run `seed-dev.ts`, so every manual-testing scenario added there is also e2e data, and e2e constraints (me1 in exactly one room, me1/me2 without a household) limit what manual testing can set up.

### Accounts

- **Signup has no rate limit, CAPTCHA or email confirmation.** With `SIGNUP_CODE` set (staging), only people with the code get that far; without it, nothing slows down automated signups and nothing checks that an email is real. Add a rate limit on `/auth/signup` and `/auth/login`, and email confirmation once the app sends email.

### Look and feel

- **App name in the nav on phones.** Below `sm` the nav shows the logo icon only, because the row is full. To show "HouseBud" there too, free up room: move the theme toggle and Logout into an account menu, and/or shorten "Find Roommates" on small screens. (Stacking the name under the icon was considered and rejected: too small, and taller sticky nav.)
- **Per-page browser tab titles** ("Chores · HouseBud"). Every page shows "HouseBud" today. The pages are client components and can't export `metadata`, so this needs a small server `layout.tsx` per section.

### Deployment

- **Migration upgrade test before the first deploy.** Every test run starts from an empty database (all migrations, then seed with current code), so nothing checks that a migration works on data written under the previous schema (a new required column without a default, a rename, a type change). Add a CI job: check out `main`, migrate and seed, switch to the branch, `prisma migrate deploy`, then run the smoke checks (e.g. `household-seed.spec.ts`).

### Code health

- **`react-hooks/set-state-in-effect` is disabled on 4 lines** (`useHouseholds`, `useMyRooms`, `ChatroomsFeedContext`, the compatibility page). Each is a load-on-mount effect whose loader sets loading/error state before its first `await`, which the rule (enforced from `eslint-config-next` 16.4) flags as a cascading render. Not a bug. Fix: move these to a fetching pattern the rule accepts (e.g. derive "loading" from the request instead of setting it in the effect), then drop the disable comments.
- **Dead code:** `authUserToUserLike` in `frontend/src/lib/displayName.ts` is unused.
- **Conflicting classes on shared components.** `Button`, `Input` and friends join their own classes with the caller's using `clsx`, so when both set the same property the winner depends on CSS order, not on which came last. Example: the Shortlist buttons use the `secondary` variant (`border-border-subtle`) and add `border-primary-500`. Fix: merge with `tailwind-merge` in the shared components.
- **`backend/scripts/seed-dev.ts`** uses `Array.prototype.at()`, which `tsconfig.scripts.json`'s target doesn't allow (`tsc -p tsconfig.scripts.json` reports 2 errors; `tsx` runs it fine).
- **Backend dependency audit leftovers.** Production: `deepmerge-ts` (pinned by Prisma 6's `@prisma/config`, only used when the Prisma CLI loads its config — goes away with Prisma 7) and `csv-parse` (fix is 7.x, a major; only `import-questions.ts` uses it, on our own CSV). Dev-only: `vitest` and its tooling. `npm audit fix` / a plain `npm update` in `backend/` currently crash inside npm (`Cannot read properties of null (reading 'edgesOut')`, while resolving `vitest`'s optional peers), so update packages by name (`npm update <pkg>`) until that's sorted — e.g. by upgrading vitest on its own branch.
- **Prisma 7 upgrade** (latest stable 7.x, not the 8.0 release candidate). Also clears the `deepmerge-ts` audit finding above. Mostly touches `createPrisma()`, `tests/setup.ts` (per-worker `datasources` override) and the generator block. Do it on its own branch with the test suite as the safety net.
