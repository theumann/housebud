# Bunkbuddy

Bunkbuddy is a web application that helps future college roommates find each other, compare lifestyle compatibility, and connect through "meet & greet" chat rooms before committing to a shared household.

## Tech Stack

-   **Frontend**: Next.js (App Router) - TypeScript - Tailwind CSS
-   **Backend**: Node.js + TypeScript - Express
-   **Database**: PostgreSQL (Docker) - Prisma ORM
-   **Auth**: JWT (stateless)

## Repository Structure

This repository contains both frontend and backend in a single monorepo-style layout.

```text
bunkbuddy/
    backend/
        # Express + Prisma API
    frontend/
        # Next.js frontend
        README.md  # You are here
```

## Local Development

### Database (PostgreSQL via Docker)

PostgreSQL runs locally in Docker.

If the container already exists:

```bash
docker start bunkbuddy-postgres
```

Otherwise:

```bash
docker run --name bunkbuddy-postgres -e POSTGRES_USER=bunkbuddy -e POSTGRES_PASSWORD=bunkbuddy -e POSTGRES_DB=bunkbuddy -p 5433:5433 -d postgres:16
```

### Backend

`cd backend`

`npm install`

`npx prisma migrate dev`

`npm run dev`

Backend runs at:`http://localhost:4000`

**Optional: seed demo data:**

```
npm run seed:all
```

### Frontend

```
cd frontend
```

```
npm install
```

```
npm run dev
```

Frontend runs at:`http://localhost:3000`

### Environment Variables

Backend uses a `.env` file (not committed to Git):

```env
DATABASE_URL=JWT_SECRET=PORT=4000
```

See backend/.env.example for reference.

### Test Automation

**Unit and integration tests** (vitest from bunkbuddy/backend): `npm test`

**End-to-end** (Playwright from bunkbuddy/frontend): `npx playwright test`

-   e2e tests with the Playwright UI: `npx playwright test --ui`
-   Global-setup runs migrations + seed:e2e (including compatibility questions)
-   auth-with-ui.spec.ts uses `test.use({ storageState: { cookies: [], origins: [] } })` to avoid authed state

### Project Status (Short-term)

-   Backend MVP complete (auth, profiles, compatibility, matching, chat)
-   Frontend MVP functional
-   Next steps:
    -   UX polish
    -   Public Profile pages
    -   Filtering and sorting Matches and Shortlist
    -   Notifications and notification preferences
    -   Deeper automated tests (Build on existing vitest and playwright tests)
    -   Deployment to Production

## Long term high level roadmap

-   Improved security (shorter token lifetimes, optional token revocation)
-   Real-time chat (WebSockets replacing HTTP polling)
-   Household management features:
    -   Shared budget and expenses tracking
    -   Chore rotation
    -   Shopping lists
    -   Household calendar
-   Housing listings and discovery

This is a high level roadmap - detailed tasks live outside this repo.