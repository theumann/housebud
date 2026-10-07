# Bunkbuddy — Claude Code Instructions

## Project Description

Bunkbuddy helps students find roommates and then run the household they form. Matching and household management are one app (see Current Direction below):

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
  - House, Appartment and room listings (later phase)
    - Rental app for shared units

## Current Direction

Matching and household management are **one app, not two**. Matching is how households get formed: people meet through matching, talk in a chat room, then form a household from that room and use the household side of the app.

Known bugs and planned improvements are tracked in `known_bugs_and_improvements.md` (repo root). Check it before starting work in an area, and remove an entry in the same change that fixes it.

### Done so far

- `backend/src/modules/household/` — create/list/get/rename, module toggles (`HouseholdSettings`: chores + shopping on by default, expenses + calendar off), join code, email invites (token, 14-day expiry), leave, remove member, transfer ownership. Guards: `requireActiveMember`, `requireOwner`, `requireEnabledModule` (for upcoming modules).
- `backend/src/errors/http.error.ts` — `HttpError` + `badRequest`/`forbidden`/`notFound`/`conflict`; `errorHandler` reads `statusCode`.
- `FEATURE_MATCHING` env flag gates the compatibility/matches/chatrooms routers. Matching is **not** being turned off — keep the flag only as an emergency off switch (or drop it) and fix the comment in `env.ts`.
- Frontend matching pages moved into the `(matching)` route group (URLs unchanged).
- Migrations: `add_households`, `add_invite_declined_at`.

### The bridge: chat room → household

1.  In a chat room, the **room owner** clicks **Form household** (owner only; if the owner leaves the room, ownership passes automatically to the longest-standing accepted participant).
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
    - Frontend: each household lives at `/household/[householdId]`; its layout loads the household and provides `CurrentHouseholdContext` (pages read it with `useCurrentHousehold()`), so a module page is `/household/[householdId]/<module>`. `/household` only redirects to the first household or shows invites + create/join.
    - The module's link appears in the Household nav row only while its setting is on (add it to `householdModules` in `AppNav.tsx`); the page shows `ModuleOff` when it's off (also on a 404 from polling). The owner's toggle is one entry in `MODULE_TOGGLES` (`HouseholdView.tsx`).
    - Polling hook (`useShoppingList`) with optimistic check/remove; a request counter makes sure a slow poll can't overwrite a newer change.
2.  **Chores** (done) — `backend/src/modules/chores/`, page `/household/[householdId]/chores`. Rules:
    - A chore repeats every N day/week/month/quarter (`repeatEvery` + `repeatUnit`; API `repeat: { every, unit }`) or is one-off (`null`, archived once done). Months and quarters move by calendar month onto `anchorDay` (the due date's day of the month), so the 31st falls back to the 28th/30th in short months and returns to the 31st after. Dates are calendar days (`@db.Date`, "YYYY-MM-DD" in the API); the client sends `completedOn` as its local date so "today" is the user's today.
    - Done late keeps the schedule: next due = due + one step, skipping occurrences that were missed entirely (`nextDueDate`).
    - Optional rotation (`Chore.rotation`, user ids in order, `rotationIndex` = whose turn). The turn passes on from the assignee even if someone else did it; members who left are skipped. The API returns the rotation in turn order, and saving a rotation makes its first member up next.
    - Any member can create, edit, delete and complete chores. Completions are kept (`ChoreCompletion`, "Recently done"); a second "done" on the same occurrence gets 409.
    - **Undo**: a chore's latest completion can be undone by any member; it restores the due date, the turn (`ChoreCompletion.previousRotationIndex`) and a one-off chore. Earlier completions can't be undone (409).
    - **Started**: any member can start a chore ("Sam started · 2:15 pm"); only the starter can stop it, and done/undo clear it. It doesn't change whose turn it is. A start by someone who has since left can be taken over.
3.  **Household chat** — separate from the matching chat (see Decided below); should reuse much of the existing chat code.
4.  **Expenses** and **calendar** — later. Expense splitting has the most rules and gets its own design discussion first.

Navigation has two sections, "Find Roommates" (Matches, Shortlist, Compatibility, Chat) and "Household" (Overview + enabled modules of the open household), each with its pages in a second row (`AppNav.tsx`).

Decided:

- **The household gets its own chat**, separate from the matching room. The matching chat shows full history to every accepted participant, so carrying it over would expose pre-household conversations to members added later and keep non-joiners in the household's conversation. The matching room stays as-is for its participants, linked via `sourceChatRoomId`. Household chat is not built yet.
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
- Errors fall through to the global `errorHandler` middleware in `src/middleware/errorHandler.ts`
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
- UI primitives live in `src/components/ui/` (Button, Card, etc.)
- Reusable UI components wrap HTML elements with `forwardRef` and extend the relevant HTML attribute interface

### State & data fetching

- Global state via React Context: `AuthContext`, `ShortlistContext`, `ChatroomsFeedContext`, `HouseholdInvitesContext`; `CurrentHouseholdContext` is scoped to `/household/[householdId]`
- Data fetching lives in custom hooks in `src/hooks/` — hooks manage loading/error state and return them to the component
- Chat uses HTTP polling (no WebSockets yet) — hooks accept a `pollMs` param and clean up intervals on unmount

### Types

- Frontend types are defined inline in context/hook files, not in a shared types directory
- Response shapes are typed directly on `apiFetch<T>` calls

---

## Testing

### Backend (Vitest) — run from `backend/`

```bash
npm test                  # all tests
npm run test:api          # API integration tests only
npm run test:coverage     # with coverage
```

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
- Tests run with `workers: 1`: the Next dev server compiles pages on first request and parallel workers make tests time out. Revisit (or switch to `next build` + `next start`) when the suite gets slow
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

---

## Deployment (Railway — not yet deployed)

Everything (Postgres, backend, frontend) goes on Railway.

- Backend: build with `npm run build`, start with `npm start` (`node dist/server.js`), with `npx prisma migrate deploy` as the pre-deploy command so each deploy applies pending migrations before starting.
- `migrate deploy` applies only migrations missing from the database's `_prisma_migrations` table — on a fresh database that is all of them, in order. Never use `migrate dev` or `db push` against production.
- `prisma` is a devDependency: confirm the CLI is available at deploy time.
- Seed data in production: run `seed:questions` once after the first deploy (matching needs the compatibility questions). It uses `createMany` with `skipDuplicates`, so re-running only **adds** questions with new codes — edits to an existing question in the CSV are silently ignored and need a separate update. `seed:users` (`seed-dev.ts`: fake users, chats, messages) must never run in production; it refuses unless `DATABASE_URL` points at localhost and `NODE_ENV` isn't `production`.
- Nothing is in production yet, so migrations could be squashed into a single `init` before the first deploy. Not worth it unless the list grows; it forces a reset of every dev/e2e database.

### Before the app sends any real email

The app sends no email today, so seed and test addresses never need to exist. Before adding email sending (invite links, password resets, notifications), fix the seed data so no mail can reach real inboxes:

- `backend/scripts/seed-dev.ts` — `me1`…`me5` use `@bunkbuddy.dev`, a real TLD on a domain we don't own. Switch them to a reserved domain (`@example.com` or `.test`), and update `frontend/tests/e2e/auth-with-ui.spec.ts`, which logs in as `me1@bunkbuddy.dev`.
- The same script's Faker users get `faker.internet.email()` addresses on real providers (gmail.com, yahoo.com…). Pass a reserved `provider` (e.g. `example.com`).
- Dev and e2e databases must never point at a real mail transport; use a sandbox/catcher in development.

---

## What to avoid

- Don't run `prisma migrate dev` or seed commands without confirming — they mutate the database
- Don't add comments unless the logic isn't self-evident
- Don't add error handling for cases that can't happen; trust Zod and Prisma
- Don't create shared utility files for one-off operations
- Don't bypass auth middleware for routes that should be protected
