# HouseBud

**Find roommates, then run the household together.**

HouseBud helps students find compatible roommates and then manage the shared household they form: chores, a shared shopping list, and more to come. Matching and household management are one app: people meet through matching, talk it over in a chat room, and form a household from that room.

> **Status: in development.** Not deployed yet; the public app will live at [housebud.app](https://housebud.app).
>
> The local database and Docker container still use the project's working name, `bunkbuddy` (see below).

## Features

### Finding roommates

- **Profiles** with school, year and target city
- **Compatibility questionnaire** on everyday habits (cleaning, guests and parties, smoking, pets, music, sharing food and bills…), with a compatibility score for every match
- **Matches**, ranked by compatibility, and a **shortlist** of people you're interested in
- **"Meet & greet" chat rooms**: invite matches into a small group chat (up to 3 rooms per person) before deciding to live together

### Running the household

- **Form a household** straight from a chat room. Everyone else in the room gets an invite and decides for themselves. You can also create a household from scratch and invite people with a join code or by their email address (the invite shows up when they log in; no email is sent yet).
- **Chores**: repeating chores (every N days, weeks, months or quarters) or one-off ones, with an optional rotation that passes the turn to the next person. Late chores stay on schedule. Mark one as started so roommates know you're on it, and undo a "done" clicked by mistake.
- **Shopping list** shared by the whole household: add items with quantities and check them off.
- **Owner controls**: rename, manage members and invites, hand over ownership, and turn features on or off.

### Coming next

Household chat, shared expenses, and a household calendar. Later: listings for shared houses and apartments, where households with a free room can look for a roommate.

## Tech stack

| Part     | Stack                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS        |
| Backend  | Node.js, Express, TypeScript, Zod                            |
| Database | PostgreSQL, Prisma ORM                                       |
| Auth     | JWT (bcrypt-hashed passwords)                                |
| Tests    | Vitest + Supertest (API), Playwright (end-to-end)            |
| Hosting  | [Railway](https://railway.app) (planned: database, API, web) |

Chat and live updates use HTTP polling for now.

## Repository layout

```text
backend/    Express + Prisma API (port 4000)
  prisma/     schema and migrations
  scripts/    seed scripts (questions, demo users and data)
  src/modules/  one folder per feature: auth, profile, compatibility,
                matches, chat, household, chores, shopping
  tests/      Vitest API tests
frontend/   Next.js app (port 3000)
  src/app/    routes: (matching) and (household) route groups
  tests/e2e/  Playwright tests
```

`CLAUDE.md` holds the project's conventions and design decisions in detail, and `known_bugs_and_improvements.md` tracks open issues.

## Running it locally

Requirements: Node.js 20+, npm, and Docker (for PostgreSQL).

### 1. Database

```bash
docker run --name bunkbuddy-postgres -e POSTGRES_USER=bunkbuddy -e POSTGRES_PASSWORD=bunkbuddy -e POSTGRES_DB=bunkbuddy -p 5433:5432 -d postgres:16
```

Next time, `docker start bunkbuddy-postgres` is enough.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET to a long random string
npx prisma migrate dev    # creates the tables
npm run seed:all:dev      # optional: resets the database and adds demo data
npm run dev               # http://localhost:4000
```

The demo data adds the compatibility questions, about 100 fake users with chats, and five accounts to log in with: `me1` to `me5`, password `Password123!`. `me4` and `me5` share a household with chores and a shopping list already in it.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

The frontend talks to `http://localhost:4000` by default; set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` to change it.

## Tests

### API tests (Vitest)

They run against a separate `bunkbuddy_test` database, one schema per test worker, wiped before each test.

```bash
docker exec bunkbuddy-postgres createdb -U bunkbuddy bunkbuddy_test   # once
```

Create `backend/.env.test`:

```env
DATABASE_URL=postgresql://bunkbuddy:bunkbuddy@localhost:5433/bunkbuddy_test
JWT_SECRET=any-test-secret
PORT=4001
NODE_ENV="test"
```

Then, from `backend/`: `npm test`.

### End-to-end tests (Playwright)

They use an `e2e` schema in the dev database, reset and re-seeded at the start of every run. Create `backend/.env.e2e`:

```env
DATABASE_URL="postgresql://bunkbuddy:bunkbuddy@localhost:5433/bunkbuddy?schema=e2e"
JWT_SECRET=any-e2e-secret
PORT=4002
NODE_ENV="test"
```

Then, from `frontend/`: `npx playwright test` (or `npx playwright test --ui`). Playwright starts its own backend (port 4002) and frontend (port 3000), so stop your frontend dev server first.

## Code formatting

Prettier, with its default settings, from the repo root: `npx prettier --write <files>`.

## License

[MIT](LICENSE) © Thierry Heumann
