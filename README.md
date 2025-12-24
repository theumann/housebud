# Bunkbuddy

Bunkbuddy is a web application that helps future college roommates find each other,
compare lifestyle compatibility, and connect through “meet & greet” chat rooms before committing to a shared household.

## Tech Stack

- **Frontend**: Next.js (App Router) · TypeScript · Tailwind CSS
- **Backend**: Node.js + TypeScript · Express
- **Database**: PostgreSQL (Docker) · Prisma ORM
- **Auth**: JWT (stateless)


## Repository Structure
This repository contains both frontend and backend in a single monorepo-style layout.

```text
bunkbuddy/
├─ backend/ # Express + Prisma API
├─ frontend/ # Next.js frontend
├─ README.md # You are here
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
docker run --name bunkbuddy-postgres \
  -e POSTGRES_USER=bunkbuddy \
  -e POSTGRES_PASSWORD=bunkbuddy \
  -e POSTGRES_DB=bunkbuddy \
  -p 5432:5432 \
  -d postgres:16
```

### Backend

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```
Backend runs at:<br>
👉 http://localhost:4000

**Optional: seed demo data:**
```bash
npm run seed:all
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at:<br>
👉 http://localhost:3000

### Environment Variables

Backend uses a `.env` file (not committedto Git):

```env
DATABASE_URL=
JWT_SECRET=
PORT=4000
```
See backend/.env.example for reference.


### Project Status (Short-term)

- Backend MVP complete (auth, profiles, compatibility, matching, chat)
- Frontend MVP functional
- Next steps:
  - UX polish
  - Public Profile pages
  - Filtering and sorting Matches and Shortlist
  - Notifications and notification preferences
  - Test automation
  - Deployment
This is a high level roadmap - detailed tasks live outside this README


## Long term high level roadmap

- Improved security (shorter token lifetimes, optional token revocation)

- Real-time chat (WebSockets replacing HTTP polling)

- Household management features:
    - Shared budget and expenses tracking
    - Chore rotation
    - Shopping lists
    - Household calendar

- Housing listings and discovery
This is a high level roadmap - detailed steps live outside this README