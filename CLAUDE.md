# HouseBud — Claude Code Instructions

## Project Description

HouseBud helps students find roommates and then run the household they form. Matching and household management are one app (see Current Direction below):

- Matching workflow (built):
  - See other Users Cards -> Add other users to a Shortlist (optional) -> Invite and/or get invited to a chatroom.
- Chatroom -> Household (in progress): a group that met through matching forms a household from its chat room.
- High level Roadmap:
  - Household management: Once a household is formed ->
    - House schedule Management
    - Chores management
    - house budget management
    - Common shopping list
    - House rules
    - More to be determined later
  - Profile photo upload: today a photo is only a pasted URL (`UserProfile.avatarUrl`, loaded from third-party servers). Let users upload one, hosted by us, and show it in the nav's account menu bubble and everywhere `Avatar` is used. Needs file storage (shared with expense receipt uploads) and settles the avatar point under "Before going live".
  - House, Appartment and room listings (later phase)
    - Rental app for shared units

## Current Direction

Matching and household management are **one app, not two**. Matching is how households get formed: people meet through matching, talk in a chat room, then form a household from that room and use the household side of the app.

Known bugs and planned improvements are tracked in `known_bugs_and_improvements.md` (repo root). Check it before starting work in an area, and remove an entry in the same change that fixes it.

### Done so far

- `backend/src/modules/household/` — create/list/get/rename, module toggles (`HouseholdSettings`: chat, chores, shopping, house rules + calendar on by default, expenses off), join code, email invites (token, 14-day expiry), leave, remove member, transfer ownership. Guards: `requireActiveMember`, `requireOwner`, `requireEnabledModule` (for upcoming modules).
- `backend/src/errors/http.error.ts` — `HttpError` + `badRequest`/`forbidden`/`notFound`/`conflict`; `errorHandler` reads `statusCode`.
- `FEATURE_MATCHING` env flag gates the compatibility/matches/chatrooms routers. Matching is **not** being turned off — keep the flag only as an emergency off switch (or drop it) and fix the comment in `env.ts`.
- Frontend matching pages moved into the `(matching)` route group (URLs unchanged).
- Migrations: `add_households`, `add_invite_declined_at`.

### The bridge: chat room → household

1.  In a chat room, the **room owner** clicks **Form household** (owner only; if the owner leaves the room, ownership passes automatically to the longest-standing accepted participant: whoever accepted longest ago, by `ChatRoomParticipant.acceptedAt`, which a re-invite clears).
2.  A `Household` is created, linked to the room via optional `Household.sourceChatRoomId` (unique — a room forms at most one household); the creator becomes owner.
3.  The room's other accepted participants get an **in-app invite** and each accepts or declines — nobody is added without consent.
4.  The room shows "This group formed _House name_". Landing page depends on state: no household → Matches, has a household → household.

Planned build order:

1.  **In-app invites** (backend done) — `GET /households/invites/mine` (pending invites whose `email` matches the logged-in user) + `POST /households/invites/:inviteId/accept|decline`. Declines are recorded in `HouseholdInvite.declinedAt`; one pending invite per email per household. Email-token and join-code invites stay for roommates who didn't come through matching.
2.  **`POST /chatrooms/:roomId/household`** (backend done) — lives on the chat side, reuses the household service (`createHousehold` with `sourceChatRoomId` + `inviteEmails`), creates the household and invites in one nested write. Rejects non-owners (403), inactive rooms or rooms with no other accepted participant (400), and rooms that already formed a household (409). `GET /chatrooms/:roomId` returns `household: { id, name } | null`. The household module does not depend on chat.
3.  **Frontend** — in slices:
    1. Household basics (done) — `/household` in the `(household)` route group: create, join by code, join code + member list; `useHouseholds` hook; "Household" is the first nav link.
    2. Invite inbox (done) — `HouseholdInvitesContext` polls `/households/invites/mine` every 30s; invitations with accept/decline at the top of `/household`; badge on the Household nav link.
    3. "Form household" in chat rooms (done) — button for the owner of an active room with ≥2 participants and no household yet; "This group formed _X_" banner with a link to `/household` for every member.
    4. State-based landing (done) — `/` (`src/app/page.tsx`) decides: household member → `/household/[id]` (their first household), otherwise `/matches`. Login and the nav logo go to `/`; signup goes straight to `/matches` (a new user has no household).
    5. Owner management (done) — on `/household` (`components/household/HouseholdView.tsx`, `useHouseholdAdmin`): rename, new join code, email invites + pending list with revoke, remove member, make owner; "Leave household" for members (an owner must hand over ownership first). Module toggles appear under "Features" — add each one with its module.

The chat room → household bridge is complete (backend and all 5 frontend slices).

### Next: household modules

Build the household modules in this order, each on its own branch:

1.  **Shopping list** (done) — the template every later module copies:
    - Backend: its own module (`backend/src/modules/shopping/`) mounted at `/households/:householdId/<module>` (`Router({ mergeParams: true })`); every service call starts with `requireActiveMember` + `requireEnabledModule`, so non-members and a turned-off module both get 404. Items are looked up by id **and** `householdId`.
    - Frontend: each household lives at `/household/[householdId]`; its layout loads the household and provides `CurrentHouseholdContext` (pages read it with `useCurrentHousehold()`). The layout stays mounted between household pages, so it re-fetches quietly on every page change, on window focus and every 30s (`useHouseholds(30_000)`) — members, settings and the name stay current without a reload, so a module page is `/household/[householdId]/<module>`. `/household` only redirects to the first household or shows invites + create/join.
    - The module's link appears in the Household nav row only while its setting is on (add it to `householdModules` in `AppNav.tsx`); the page shows `ModuleOff` when it's off (also on a 404 from polling). The owner's toggle is one entry in `MODULE_TOGGLES` (`HouseholdView.tsx`).
    - Polling hook (`useShoppingList`) with optimistic check/remove; a request counter makes sure a slow poll can't overwrite a newer change.
2.  **Chores** (done) — `backend/src/modules/chores/`, page `/household/[householdId]/chores`. Rules:
    - A chore repeats every N day/week/month/quarter (`repeatEvery` + `repeatUnit`; API `repeat: { every, unit }`) or is one-off (`null`, archived once done). Months and quarters move by calendar month onto `anchorDay` (the due date's day of the month), so the 31st falls back to the 28th/30th in short months and returns to the 31st after. Dates are calendar days (`@db.Date`, "YYYY-MM-DD" in the API); the client sends `completedOn` as its local date so "today" is the user's today.
    - Done late keeps the schedule: next due = due + one step, skipping occurrences that were missed entirely (`nextDueDate`).
    - Optional rotation (`Chore.rotation`, user ids in order, `rotationIndex` = whose turn). The turn passes on from the assignee even if someone else did it; members who left are skipped. The API returns the rotation in turn order, and saving a rotation makes its first member up next.
    - Any member can create, edit, delete and complete chores. Completions are kept (`ChoreCompletion`, "Recently done"); a second "done" on the same occurrence gets 409.
    - **Undo**: a chore's latest completion can be undone by any member; it restores the due date, the turn (`ChoreCompletion.previousRotationIndex`) and a one-off chore. Earlier completions can't be undone (409).
    - **Started**: any member can start a chore ("Sam started · 2:15 pm"); only the starter can stop it, and done/undo clear it. It doesn't change whose turn it is. A start by someone who has since left can be taken over.
3.  **Household chat** (done) — `backend/src/modules/household-chat/` (`HouseholdMessage`), page `/household/[householdId]/chat`. Separate from the matching chat (see Decided below); the message list + composer is the shared `components/chat/MessageThread.tsx`, also used by matching chat rooms. Members only see messages sent since they joined (`HouseholdMember.joinedAt`, reset when someone who left or was removed rejoins; seeds back-date it so their messages show); former members lose access. `GET …/chat/messages?after=<createdAt>` returns messages at or after that time (inclusive, so a same-millisecond message isn't missed, and never before `joinedAt`); `useHouseholdChat` loads the history once, then polls with `after` and skips ids it already has. **Unread:** `GET /households` returns `unreadMessages` per household (messages from others after `HouseholdMember.chatReadAt` or `joinedAt`, whichever is later; 0 while chat is off), stored on the server so reading on one device clears it everywhere. While the chat page has focus (`document.hasFocus()`: a window left visible behind another isn't being read; the matching room page uses the same rule for its `localStorage` marker) it posts `POST …/chat/read { upTo }` with the newest message shown (not "now", so a message arriving meanwhile stays unread; the read point never moves backwards or into the future). `HouseholdInvitesContext` polls the counts with the invites; the badge is on the household Chat link, and on the Household section link from elsewhere in the app. Badges count chats with something new, not messages (like the matching Chat link's unread rooms); the API keeps the message count for a future per-chat count.
4.  **Expenses** (done) — `backend/src/modules/expenses/` (`Expense`, `ExpenseShare`, `Settlement`), page `/household/[householdId]/expenses`. Rules (decided 2026-10-17):
    - Amounts are integer cents in one currency per household (`HouseholdSettings.currency`, default USD; the owner picks it under Features).
    - One payer per expense, by default the person entering it, who can pick another active member instead. The expense is split equally between the selected members (default: everyone active); leaving someone out covers "the vegetarian doesn't pay for the chicken". Shares are stored as final amounts that add up to the total (`splitEqually`: leftover cents go one each to the first user ids), so splits by shares or exact amounts later only need UI.
    - Only the creator, the payer or the owner can edit or delete an expense; for a payment, the recorder, either person in it or the owner. The API returns `canEdit` for each.
    - Balances are never stored: `GET …/expenses` computes them (paid − shares + payments made − payments received) along with suggested transfers (the biggest debtor pays the biggest creditor, repeat). "Mark as paid" records a `Settlement`; any payment can also be entered by hand.
    - Newcomers aren't in older expenses. Someone who leaves with an open balance is warned but can leave; the others keep seeing the balance ("former member") and can record payments with them. Former members lose access, as with chat.
    - Shopping → expenses per trip: "I bought these" on the items you checked off creates one expense for the receipt total and links them (`ShoppingItem.expenseId`); there are no prices on individual items.
    - Later: splits by shares or exact amounts, recurring bills (reusing the chore repeat rules), receipt uploads (need file storage), categories.
5.  **House rules** (done) — `backend/src/modules/rules/` (`HouseRule`, `RuleProposal`, `RuleVote`), page `/household/[householdId]/rules`. Rules (decided 2026-10-19):
    - A list of rules (title up to 120 chars, optional details), in the order they were adopted. Nobody edits a rule directly, the owner included: every add, change or removal is a proposal (`kind` add/change/remove, optional reason).
    - The proposer agrees automatically. A proposal is adopted when every **active** member has agreed, then applied to the rules; one "no" (optional reason) declines it. The proposer or the owner can withdraw it. At most one open proposal per rule (409); one answer per person (409).
    - Membership changes need no hooks in the household module: the rules service settles open proposals at the start of every call, so a proposal only waiting on someone who left is adopted on the next read, and a newcomer becomes a voter on proposals still open.
    - **Newcomers agree**: someone who joined after a rule was adopted sees "I agree" until they do (`HouseholdMember.rulesAgreedAt`, compared with `joinedAt` so rejoining asks again); the others see who hasn't. It blocks nothing. Founding members don't need to, since they voted on each rule.
    - **Badge**: `GET /households` returns `pendingRules` (open proposals I haven't answered, +1 if I still need to agree; 0 while the module is off); `HouseholdInvitesContext` keeps it, shown on the House rules link and on the Household section link from elsewhere.
    - A household with no rules sees a list of common starter rules (frontend constant in `HouseRules.tsx`) in their own card, each opening the proposal form prefilled; once it has rules, they move into the form for a new rule (collapsed "Start from a common rule"). Starters already a rule or an open proposal (same title) are hidden. History shows the 10 most recently decided proposals.
    - Later: reordering, categories, comments on proposals, a chat message for new proposals, suggestions from compatibility answers.
6.  **Calendar** (built, branch `calendar`) — `backend/src/modules/calendar/` (`CalendarEvent`), page `/household/[householdId]/calendar`, plus a "Coming up" card on the household Overview (`ComingUp.tsx`: the next 7 days, overdue chores as one "N overdue chores" line, hidden when empty or while the calendar is off). Rules (decided 2026-10-20):
    - One table, three kinds: `event` (title, optional notes; all-day over one or more days, or timed on one day), `away` (a member away for a range of days, optional note) and `guest` (a member's guest for a range of days; the title is the guest, e.g. "My sister"). Away/guest entries are about a member (`userId`): yourself, or anyone when the owner adds it.
    - Dates are calendar days (`@db.Date`) and times the house's clock time (`"19:00"`), no time zone: housemates live in the same place, and repeats stay clear of daylight-saving bugs. A household time zone can come later.
    - Only one-day events repeat, with the chore repeat rules (`step` and `repeatOf` from `chores.service.ts`); edits apply to the whole series, which runs until deleted. "Skip this one" adds the day to `skippedDates`; moving the series or changing its repeat clears them.
    - Edit/delete/skip: events by whoever added them or the owner; away/guest entries by the person they're about or the owner (`canEdit` in the API). Entries about someone who left are hidden.
    - Chores show read-only (while chores are on), computed from each chore's due date and repeat with the turn projected through the rotation; an overdue chore sits on the viewer's today (`today` query param) and its repeats carry on after it.
    - API: `GET …/calendar?from&to&today` (≤ 62 days) returns `occurrences`, one per day (multi-day entries on each day), sorted away, guests, all-day events, chores, then by time; `POST /events`, `PUT /events/:id` (the whole entry; the kind can't change), `DELETE /events/:id`, `POST /events/:id/skip { date }`.
    - Frontend: agenda (4 weeks, Earlier/Later; an entry over several days has its notes and buttons only on the first day shown) or month grid (6 weeks, dots per kind, the picked day's list underneath); no badge.
    - Later: "repeat until", editing one occurrence, timed multi-day events, a household time zone, recurring bills on the calendar, away entries in chore turns.

Navigation has two sections, "Find Roommates" (Matches, Shortlist, Compatibility, Chat) and "Household" (Overview + enabled modules of the open household), each with its pages in a second row (`AppNav.tsx`). Below the `sm` breakpoint, a row of more than 4 entries keeps the first 3 and puts the rest under a "More" menu, whose badge adds up the badges of the pages it holds; wider windows show the whole row. Menus close on an outside click or Escape (`useMenuDismiss`, shared with the account menu).

Decided:

- **The household gets its own chat**, separate from the matching room. The matching chat shows full history to every accepted participant, so carrying it over would expose pre-household conversations to members added later and keep non-joiners in the household's conversation. The matching room stays as-is for its participants, linked via `sourceChatRoomId`.
- **Re-inviting to a chat room:** people who declined or left can be invited again by any accepted member; someone the owner removed can only be brought back by the owner. Re-invites reset them to pending as a plain member, and the 3-room limit applies. No protection against repeated re-invites yet — that will come with block/reject.

Open questions:

- Later: households with an open spot appear in matching as "looking for a roommate" (fits the listings phase). Not now, but don't design it out.

## Project Layout

Monorepo with two independent packages:

- `backend/` — Express + Prisma API (port 4000)
- `frontend/` — Next.js App Router (port 3000)

Always run `npm` commands from within the relevant subdirectory (`backend/` or `frontend/`), not the repo root.

---

## Backend Conventions

### Module structure

Each feature lives in `backend/src/modules/[feature]/` with four files:

```
[feature].routes.ts      # Router (default export)
[feature].controller.ts  # Handler functions
[feature].service.ts     # Business logic (receives prisma as first arg)
[feature].types.ts       # Zod schemas + inferred TS types
```

### Handler pattern

All handlers follow this exact shape — Zod parse, delegate to service, pass errors to `next`:

```typescript
export async function fooHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = FooSchema.parse(req.body);
    const result = await fooService(req.prisma, input);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
```

- Validate with Zod at the controller level, not in the service
- Services are pure functions — they receive `prisma: PrismaClient` as the first parameter
- Errors fall through to the global `errorHandler` middleware in `src/middleware/errorHandler.ts`; a `ZodError` becomes a 400 whose message names the field (`password: Too small: …`)
- Custom errors extend or resemble `AuthError` (statusCode + message)

### Prisma

- Client is instantiated once in `server.ts` via `createPrisma()` and injected into every request via middleware
- Access in handlers via `req.prisma` (typed via `backend/src/types/express.d.ts`)
- Never import or instantiate PrismaClient directly in a handler or service

### Auth

- Protected routes use `authMiddleware` from `src/middleware/authMiddleware.ts`
- Middleware extracts `userId` from a `Bearer <token>` header and attaches it to `req.userId`
- JWT payload shape: `{ userId: string }`, 7-day expiry
- Passwords hashed with bcrypt, 10 rounds

### Types

- Define a Zod schema first, then derive the TS type: `export type FooInput = z.infer<typeof FooSchema>`
- Keep schemas and types in `[feature].types.ts`

---

## Frontend Conventions

### API calls

All backend communication goes through `src/lib/api.ts`:

```typescript
const data = await apiFetch<SomeType>("/endpoint", {
  method: "POST",
  token,
  body: payload,
});
```

- Always pass the token from `useAuth()`: `const { token } = useAuth()`
- Never use raw `fetch` — always use `apiFetch`
- Non-2xx responses throw `ApiError` (with `status`). Branch on the status, not the message — e.g. `AuthContext` clears the token only on a 401; any other failure (including a request cancelled by navigation) keeps the user logged in
- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:4000`)

### Components & pages

- All pages use `"use client"` — there are no Server Components currently
- Components are PascalCase, hooks are camelCase with a `use` prefix
- Styling is Tailwind only — no CSS modules or inline style objects
- Colors come from the theme tokens in `src/app/globals.css`, which switch for dark mode — not raw Tailwind palette classes:
  - Text: `text-foreground`, `text-foreground-soft`, `text-muted`, `text-subtle`, `text-faint` (strongest to faintest) instead of `text-gray-*`
  - Brand: `primary-*` (the logo's teal) instead of `blue-*`. Buttons use `bg-primary-600`; teal text uses `text-primary-700 dark:text-primary-400`
  - Surfaces and borders: `bg-surface`, `bg-surface-muted`, `border-border-subtle` (dividers, cards), `border-border-strong` (form controls)
  - Red, green and amber stay as status colors (errors, success, warnings)
  - Every text token, `text-faint` included, keeps WCAG AA contrast (4.5:1) on every surface in both themes; `accessibility.spec.ts` checks it. A new color for text needs the same
- Form fields use `Input`, `Select` and `Textarea` from `src/components/ui/Input.tsx` (they set no width — pass `w-full` etc.); checkboxes and radios stay plain `<input>` and get the brand color from `globals.css`
- Brand: `Logo` (`src/components/Logo.tsx`) is the icon (`public/logo-mark.svg`) plus the "HouseBud" wordmark in Nunito. The UI font is Figtree, loaded in `src/app/layout.tsx` as `--font-app`
- UI primitives live in `src/components/ui/` (Button, Card, Input, Avatar, etc.). Show people with `Avatar` (photo, or their initial on a color fixed by user id)
- Reusable UI components wrap HTML elements with `forwardRef` and extend the relevant HTML attribute interface

### State & data fetching

- Global state via React Context: `AuthContext`, `ShortlistContext`, `ChatroomsFeedContext`, `HouseholdInvitesContext` (also the household chat unread counts); `CurrentHouseholdContext` is scoped to `/household/[householdId]`
- Data fetching lives in custom hooks in `src/hooks/` — hooks manage loading/error state and return them to the component
- Chat uses HTTP polling (no WebSockets yet) — hooks accept a `pollMs` param and clean up intervals on unmount

### Types

- Frontend types are defined inline in context/hook files, not in a shared types directory
- Response shapes are typed directly on `apiFetch<T>` calls

---

## Testing

`docs/test-plan.md` is the written test plan (levels, risks, exclusions, entry/exit criteria, defect tracking, what testing has found). Update it in the same change when a test level, environment, exclusion or criterion changes, and add a row to its findings table when a test finds a real bug.

CI (`.github/workflows/ci.yml`, GitHub Actions) runs on every PR and push to `main`: a checks job (Prettier on the whole repo, backend `test:types` + unit tests + `build`, frontend `lint` + `build`), the API tests against a Postgres 16 service (with coverage: the run fails below the thresholds in `vitest.config.ts`, and the job summary shows the numbers), and Playwright against its own Postgres, one job per browser engine (Chromium + Pixel 7, Firefox, WebKit + iPhone 14), inside Playwright's Docker image (`mcr.microsoft.com/playwright`, browsers and system libraries preinstalled; its tag must match `@playwright/test` in `frontend/package-lock.json`). Every job runs on `ubuntu-24.04`, pinned. CI writes `backend/.env.test` and `.env.e2e` itself (throwaway credentials, no secrets). In CI only, Playwright retries a failed test once (reported as "flaky") and saves an HTML report as an artifact.

### Backend (Vitest) — run from `backend/`

```bash
npm test                  # all tests
npm run test:unit         # unit tests only (no database)
npm run test:api          # API integration tests only
npm run test:coverage     # all tests with coverage (HTML report in coverage/)
```

Coverage counts `src/` (not `server.ts`, types or the seed scripts) over both projects together. The frontend has none: its behaviour is covered by Playwright, which measures no coverage.

Two Vitest projects (`vitest.config.ts`):

- **unit** (`tests/unit/`): pure functions with rules worth pinning down — chore repeat steps and next due dates, rotation turn order, calendar repeats (`eventDays`), equal splits, balances and suggested transfers. No database and no setup, so they run in seconds and Claude can run them. Export a function from its service to test it; when a rule lives inside a database call, pull the pure part out first
- **api** (`tests/api/`, `tests/scripts/`): the endpoints against Postgres

API tests:

- Tests use worker-isolated PostgreSQL schemas (`test_w{workerId}`) — requires `DATABASE_URL` pointing to `bunkbuddy_test`
- `resetDb()` is called in `beforeEach` — each test starts with a clean schema
- Use the factory helpers in `tests/helpers/testFactory.ts` (`signupUser`, etc.) rather than calling endpoints manually
- HTTP testing via `supertest`: `request(ctx.app).post("/auth/signup").send(...)`

### Frontend E2E (Playwright) — run from `frontend/`

```bash
npx playwright test
npx playwright test --ui
```

- E2E data lives in the `e2e` schema of the dev database (`backend/.env.e2e`), not in `bunkbuddy_test`
- Global setup resets that schema (`prisma migrate reset --force --skip-seed`), runs `seed:e2e`, and pre-authenticates as `me1` / `Password123!` — every run starts clean, and data from the last run stays around for debugging until the next one
- `seed:e2e` runs the same `seed-dev.ts` as `seed:users`, including its fixed scenarios: `me3` is in 3 chat rooms (the limit), `me1` in exactly one (`chatrooms.spec.ts` opens it), `me4` + `me5` share "Seeded Test household" (with chores in every state, chore history, a shopping list, a few chat messages, expenses (me5 owes me4 $13.00), house rules (a proposal from me4 waiting for me5) and calendar entries (a weekly house meeting, events, me5 away, a guest of me4's), dates relative to the seed day — checked read-only by `household-seed.spec.ts`), and the other "me" users are in no room. `me1` and `me2` must stay without a household — `auth-with-ui.spec.ts` expects them to land on Matches
- Five projects: desktop `chromium`, `firefox`, `webkit`, and the emulated phones `pixel-7` (Chromium) and `iphone-14` (WebKit) — emulated devices, not real phones. A test tagged `@phone` or `@desktop` (`{ tag: "@phone" }`) runs only on those projects; tag only what can't work on the other, with the reason in the test. `npx playwright test --project=chromium` for a quick local run
- Playwright serves a production build (`next build` + `next start`, rebuilt every run) and runs 4 workers locally, all cores in CI. `next dev` compiled pages on first request, which made parallel workers time out
- Parallel-safe by rule: tests never change seed users' data (me1–me5 are read-only), and fresh users get a ZIP outside the seed's 941xx so they don't show up on the seed users' Matches. A test that checks who appears on Matches gives its users a `randomZip()`
- `accessibility.spec.ts` runs axe (WCAG 2.1 A + AA) on every main page, in light and dark mode (dark is the app's own `theme` setting in localStorage, not the browser's color scheme), on `chromium` and `pixel-7` only: the rules don't depend on the engine. A new page or module gets a line in it. It waits for running animations first: a button caught mid-fade fails contrast
- Click household nav links with `clickNav(page, testId)` (`utils/nav.ts`): on a phone the links past the first 3 are under "More"
- Log in through the form with `loginWithForm` (`utils/auth.ts`): it waits for the page to hydrate first, since on WebKit a click before that is a plain form submit that reloads `/login`. Otherwise log in with `loginAs`, which sets the token on `/robots.txt` (on `/login` the page itself could redirect to `/` mid-test)
- Auth state is saved to `playwright/.auth/storageState.json` and reused by all tests
- Tests that need a logged-out state use: `test.use({ storageState: { cookies: [], origins: [] } })`
- Use `data-testid` attributes for selectors; add them when writing new components that need E2E coverage
- Import `test` and `expect` from `./utils/test`, not `@playwright/test`: it attaches a "diagnostics" timeline (failed API calls, console errors, navigations, token state) to every failing test
- Tests that create persistent state (households, invites) sign up fresh users through the API and put their token in `localStorage` (`bb_token`) instead of using `me1`, so they don't change what other tests in the same run see — see `tests/e2e/household.spec.ts`

---

## Environment

| File                | Used for                                   |
| ------------------- | ------------------------------------------ |
| `backend/.env`      | Local dev                                  |
| `backend/.env.test` | Vitest API tests                           |
| `backend/.env.e2e`  | Playwright e2e (backend runs on port 4002) |

Required backend vars: `DATABASE_URL`, `JWT_SECRET`, `PORT`

Optional: `SIGNUP_CODE` — when set, `POST /auth/signup` requires it (403 otherwise, checked before anything else) and the signup page shows an "Invite code" field (`GET /auth/signup-options`). `/signup?code=…` fills it in, so an invite can be a link. Trimmed and case-insensitive. Unset in local dev and tests; set on staging.

Optional, **staging only — never production**: `DEMO_SANDBOX=true` turns on "Try the demo". `POST /demo/sandbox` (404 when off) creates a throwaway visitor (`@sandbox.example.com`) who owns "Maple Street House" with two of the `seed:demo` users as housemates (503 if they don't exist), chores in every state, a shopping list, a short household chat, expenses (the visitor owes a housemate), house rules (a proposal waiting for the visitor) and calendar entries (a weekly house meeting, events, a housemate away, the visitor's guest), and returns a 24-hour login. Sandboxes older than 24 hours are deleted whenever a new one is created (no scheduled job), at most 60 are created per hour (429), and Matches never shows sandbox users. The frontend's `/demo` page starts one and lands on the household; login and signup link to it when it's on (`demoAvailable` in `GET /auth/signup-options`). Link to `https://<frontend>/demo` from outside the app. `frontend/public/robots.txt` disallows `/demo`: crawlers that run JavaScript (Google's does) would otherwise create a sandbox on every visit.

### Testing on a phone

The phone must be on the same Wi-Fi as the PC, and that network must be set to Private in Windows.

1. Find the PC's Wi-Fi address with `ipconfig` (the "Wi-Fi" adapter). The "Network" address `next dev` prints is usually the WSL virtual adapter, which the phone can't reach.
2. In `frontend/.env.local` (gitignored), set `NEXT_PUBLIC_API_BASE_URL=http://<that IP>:4000` — on the phone `localhost` is the phone itself. `next.config.ts` adds the same host to `allowedDevOrigins`; without it Next blocks the dev scripts and the page loads but doesn't respond.
3. Restart the frontend (both files are only read at startup) and open `http://<that IP>:3000` on the phone.

The address can change after a router or PC restart; update `.env.local` and restart. Set it back to `localhost` to turn this off.

---

## Deployment (Railway — not yet deployed)

Everything (Postgres, backend, frontend) goes on Railway.

- Backend: build with `npm run build`, start with `npm start` (`node dist/server.js`), with `npx prisma migrate deploy` as the pre-deploy command so each deploy applies pending migrations before starting.
- `migrate deploy` applies only migrations missing from the database's `_prisma_migrations` table — on a fresh database that is all of them, in order. Never use `migrate dev` or `db push` against production.
- `prisma` is a devDependency: confirm the CLI is available at deploy time.
- Seed data in production: run `seed:questions` once after the first deploy (matching needs the compatibility questions). It uses `createMany` with `skipDuplicates`, so re-running only **adds** questions with new codes — edits to an existing question in the CSV are silently ignored and need a separate update. To run it against a deployed database, put that database's **public** URL in a gitignored env file (e.g. `backend/.env.staging` with `DATABASE_URL=…`; on Railway it's in the Postgres service's Connect → Public Network, which needs its TCP proxy on) and run `$env:DOTENV_CONFIG_PATH=".env.staging"; npm run seed:questions` from `backend/`. `seed:users` (`seed-dev.ts`: fake users, chats, messages) must never run in production; it refuses unless `DATABASE_URL` points at localhost (or at the `postgres` service inside CI's e2e container, only when `GITHUB_ACTIONS=true`) and `NODE_ENV` isn't `production`.
- Demo users on staging: `seed:demo` (`scripts/seed-demo.ts`) replaces the staging demo users with 50 Faker users in San Francisco (941xx ZIPs, since Matches only shows people whose target ZIP shares the first three digits) with compatibility answers, and a photo on about 60% (Faker's portrait set, hand-picked student-age ones in `scripts/portraits.ts`, shared with `seed-dev`, matched to the name's sex, loaded from jsDelivr — never `faker.image.avatar()`, which mixes in real GitHub users' pictures); `npm run seed:demo -- --remove` only removes them. Both ask for a `y` first when demo sandboxes are active (created in the last 24 hours), since those visitors would lose their housemates; `-- --yes` skips the question. They're the users whose email ends in `@demo.example.com`; nobody can log in as one. Removing them also removes their chat participations, shortlist entries and answers (cascade). It runs the same way as `seed:questions` against the staging database, and only on a database whose Postgres comment is `housebud:staging` (and never with `NODE_ENV=production`). Mark the staging database once, never production: `echo "COMMENT ON DATABASE railway IS 'housebud:staging';" | npx dotenv -e .env.staging '--' npx prisma db execute --stdin --schema prisma/schema.prisma` from `backend/` (quote the `--`: Windows PowerShell drops a bare one before calling the program).
- Nothing is in production yet, so migrations could be squashed into a single `init` before the first deploy. Not worth it unless the list grows; it forces a reset of every dev/e2e database.

### Before the app sends any real email

The app sends no email today, so seed and test addresses never need to exist. Before adding email sending (invite links, password resets, notifications), fix the seed data so no mail can reach real inboxes:

- `backend/scripts/seed-dev.ts` — `me1`…`me5` use `@housebud.app`, the app's own domain, so their mail can only ever reach us (done). `frontend/tests/e2e/auth-with-ui.spec.ts` logs in as `me1@housebud.app`.
- The same script's Faker users get `faker.internet.email()` addresses on real providers (gmail.com, yahoo.com…). Pass a reserved `provider` (e.g. `example.com`).
- Dev and e2e databases must never point at a real mail transport; use a sandbox/catcher in development.

### Before going live

Terms and a privacy policy are deliberately not written yet: the policy has to describe what the app actually does with data at launch (email provider, hosting region, expenses, analytics), and some of what it must promise doesn't exist yet. Build them on their own branch close to launch, and check off:

- **Terms and Privacy pages**, linked in the footer and at signup with an explicit "I agree" (record when and which version was accepted).
- **Minimum age**: decide it (students can be 17; COPPA under 13, GDPR consent age 13–16 by country) and check it at signup — we already collect `birthDate`.
- **Account deletion and data export** — required by GDPR and CCPA/CPRA, and the app has neither. The policy can't promise them until they exist.
- **Data inventory** for the policy: profile (birth date, school, city), compatibility answers, chat messages, household data (chores, shopping, later expenses), and who sees what. Some answers are sensitive (smoking, alcohol, allergies — arguably health data under GDPR): decide how they're shown and stored.
- **Avatars**: `avatarUrl` is a free-text URL loaded from third-party servers, which exposes viewers' IP addresses. Host uploads ourselves or say so in the policy.
- **Cookies and analytics**: none today (the auth token is in `localStorage`). State it, and revisit if analytics are added.
- **Contact address** for privacy requests (e.g. `privacy@housebud.app`).
- **Legal review** of both texts (or start from a reputable generator and adapt), for the jurisdictions we target.

---

## What to avoid

- Don't run `prisma migrate dev` or seed commands without confirming — they mutate the database
- Don't add comments unless the logic isn't self-evident
- Don't add error handling for cases that can't happen; trust Zod and Prisma
- Don't create shared utility files for one-off operations
- Don't bypass auth middleware for routes that should be protected
