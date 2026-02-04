# Backend - Bunkbuddy API

This folder contains the Express + Prisma backend powering Bunkbuddy.

The backend exposes a REST API consumed by the Next.js frontend.

## High-Level Architecture

**Backend**

-   Node.js + TypeScript
-   Express HTTP API
-   PostgreSQL (via Docker)
-   Prisma ORM (code-first schema + migrations)
-   JWT-based stateless authentication
-   Modular structure (auth, profile, compatibility, matches, chat)
-   Automated testing: Vitest for the backend. Commands are in the repo level README file (../README from here)

**Runtime**

-   Backend runs on `http://localhost:4000`
-   e2e tests (Playwright) run on `http://localhost:4002`
-   Frontend runs on its own dev port (e.g. `http://localhost:3000`) and calls the backend API

---

## Backend Overview

### Tech Stack

-   **Runtime**: Node.js 22.x
-   **Language**: TypeScript
-   **Web framework**: Express
-   **ORM**: Prisma (v6)
-   **Database**: PostgreSQL (Docker container)
-   **Validation**: Zod
-   **Auth**: JWT (`Authorization: Bearer <token>`), bcrypt for password hashing

### Folder Structure (backend)

```text
backend/
  src/
    app.ts                # Express app wiring
    server.ts             # HTTP server bootstrap
    config/
      db.ts               # Prisma client
      env.ts              # Environment variables
    middleware/
      authMiddleware.ts   # JWT auth, attaches userId to request
      errorHandler.ts     # Centralized error handling
    modules/
      auth/               # signup, login, logout
      profile/            # user profile CRUD
      compatibility/      # questions + answers for roommate matching
      matches/            # roommate match listing + scoring
      chat/               # chat rooms + messages (polling)
  prisma/
    schema.prisma         # DB schema (source of truth)
  .env                    # DATABASE_URL, JWT_SECRET, etc.
```

### Core Backend Modules

#### 1. Auth

-   `POST /auth/signup`
-   `POST /auth/login`
-   `POST /auth/logout` (stateless: client is responsible for deleting the token)

Responsibilities:

-   Create users with hashed passwords
-   Create associated `UserProfile` and `UserSettings`
-   Issue JWTs on signup/login

#### 2. Profile

-   `GET /profile/me`
-   `PATCH /profile/me`

Responsibilities:

-   Store core roommate-related profile information:
    -   first name, last name, username
    -   DOB, school, college year
    -   target city/state/zip
    -   optional fields: displayName, original city/state, bio, avatar URL
-   Used in matching and in UI cards

#### 3. Compatibility

-   `GET /compatibility/questions`
-   `GET /compatibility/answers/me`
-   `PUT /compatibility/answers/me`

Responsibilities:

-   Store a configurable list of **single-choice** compatibility questions
-   Store per-user answers as strings (validated against allowed options)
-   Compute coverage:
    -   how many active questions a user has answered
    -   `hasMinCompatData`: `true` when coverage >= 20%
-   Used by the matching logic to determine whether a compatibility score can be computed

#### 4. Matches

-   `GET /matches?page=&limit=`

Responsibilities:

-   Filter candidate users based on:
    -   same / nearby ZIP (simple prefix match on first 3 digits)
    -   active profiles
    -   not the current user
    -   not users already in 3 accepted chat rooms
-   Compute a simple compatibility score for candidates that have enough data:
    -   Score = percentage of matching answers on questions both users answered
    -   Range: 0-100 (integer)
-   Sort results by:
    1.  Scored matches, descending by score, newest first
    2.  Unscored users in same zip, newest first
    3.  Other nearby users, newest first

Returns a list of match "cards" with:

-   basic profile info (displayname (or username if no displayName), age, school, location, bio, avatar)
-   `score`, `coverage`, `hasMinCompatData`

#### 5. Chat (Meet & Greet)

-   `GET /chatrooms`
    -> returns `{ rooms: [...], invites: [...] }` for the current user
-   `POST /chatrooms`
    -> create a new chat room, invite at least one other user
-   `POST /chatrooms/:roomId/invite`
    -> invite additional participants
-   `POST /chatrooms/:roomId/accept`
    -> accept invite
-   `POST /chatrooms/:roomId/decline`
    -> decline invite
-   `POST /chatrooms/:roomId/leave`
    -> leave a room (owner reassignment if needed, room deactivation if < 2 accepted)
-   `POST /chatrooms/:roomId/kick`
    -> owner kicks a participant
-   `GET /chatrooms/:roomId/messages?after=`
    -> list messages (polling)
-   `POST /chatrooms/:roomId/messages`
    -> send a message

Rules:

-   Max **3 active rooms per user** (accepted status)
-   Each room has:
    -   an owner (`role = owner`)
    -   members (`role = member`)
    -   statuses: `pending`, `accepted`, `declined`, `left`, `removed`
-   Owner leaving:
    -   ownership is transferred to the oldest remaining accepted member
    -   if < 2 accepted participants remain, room is marked inactive
-   Chat transport:
    -   **MVP**: HTTP polling via `GET /chatrooms/:id/messages?after=timestamp`
    -   Future: can swap to WebSockets

---

## Data Model (High Level)

**User**

-   Auth data (identifier, password hash)
-   One-to-one with `UserProfile`
-   One-to-one with `UserSettings`

**UserProfile**

-   Personal + roommate-relevant data (school, year, target location, etc.)

**UserSettings**

-   Notification preferences (foundation laid, can be expanded later)

**CompatibilityQuestion**

-   `code`, `text`, `type` (`"single_choice"` for MVP)
-   `options` (JSON array of strings)
-   `isActive`, `orderIndex`

**CompatibilityAnswer**

-   `(userId, questionId)` unique
-   `value` (must be one of the `options`)

**ChatRoom**

-   `createdByUserId`, `isActive`
-   Participants and messages are separate tables

**ChatRoomParticipant**

-   `userId`, `chatRoomId`, `role`, `status`
-   Enforces room membership limits and ownership rules

**ChatMessage**

-   `chatRoomId`, `senderUserId`, `text`, `createdAt`