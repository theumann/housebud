# Production setup (Railway)

Checklist for the first production environment, ahead of the first real household. Staging stays as it is: demo users, "Try the demo", reseeded when needed. Production holds real people's data and none of that.

Tick each box as it's done. Once production is live, update "Deployment" in `CLAUDE.md` and the scope in `docs/test-plan.md`, which both still say nothing is in production.

## 1. Environment and database

- [ ] In the Railway project, create a new environment `production`. Start it empty rather than duplicating staging, so no staging variable (`DEMO_SANDBOX`, `SIGNUP_CODE`, the database URL) comes along by accident.
- [ ] Add a Postgres service to it. Leave its TCP proxy off; turn it on only to run `seed:questions` (step 5).
- [ ] Don't put the `housebud:staging` comment on this database. `seed:demo` refuses to run without it, which is the point.

## 2. Backend service

Same settings as the staging backend:

- [ ] Source: this repo, root directory `backend`.
- [ ] Build `npm run build`, start `npm start`.
- [ ] Pre-deploy command `npx prisma migrate deploy` (never `migrate dev` or `db push`). `prisma` is a devDependency: check the first deploy's log shows the migrations applied, not "prisma: not found".
- [ ] Health check path `/health`.

Variables:

| Variable           | Value                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | Reference to the production Postgres's private URL (`${{Postgres.DATABASE_URL}}`)                                                                                                  |
| `JWT_SECRET`       | New random value, never staging's: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. A shared secret would let staging tokens log in to production |
| `SIGNUP_CODE`      | New code, different from staging's (the staging one has been handed out with the demo)                                                                                             |
| `NODE_ENV`         | `production` (the seed scripts refuse to run with it)                                                                                                                              |
| `DEMO_SANDBOX`     | **Not set.** Never `true` in production                                                                                                                                            |
| `FEATURE_MATCHING` | **Not set.** The frontend doesn't read it, so `false` would break the Matches, Shortlist and Chat pages instead of hiding them                                                     |

`PORT` is provided by Railway.

## 3. Frontend service

- [ ] Source: this repo, root directory `frontend`. Build `npm run build`, start `npm start`.
- [ ] `NEXT_PUBLIC_API_BASE_URL` = the production backend's public URL, set **before the first build**: Next bakes it into the bundle, so changing it later needs a redeploy.
- [ ] Generate public domains for both services (`*.up.railway.app` is fine for the test; a custom domain can come later).

## 4. Deploy trigger

Staging deploys every merge to `main`. Production shouldn't: a change should spend some time on staging first.

- [ ] Create a `production` branch from `main` and connect both production services to it (service Settings → Source → branch).
- [ ] Turn on "Wait for CI" so a red build never deploys.
- [ ] Releasing = fast-forwarding it to a commit already on staging: `git push origin <commit>:production` (or `main:production`). Keep the `main` ruleset off this branch, or releases would need a PR each time.

## 5. Data

- [ ] Run `seed:questions` once (matching needs the compatibility questions). In a gitignored `backend/.env.production` put the production Postgres's **public** URL (turn its TCP proxy on first), then from `backend/`: `$env:DOTENV_CONFIG_PATH=".env.production"; npm run seed:questions`. Turn the proxy off again and delete the file, or at least the URL in it.
- [ ] Never run `seed:users`, `seed:demo` or `seed:e2e` against production. `seed-dev.ts` refuses non-localhost databases and `seed-demo.ts` needs the staging marker, but don't rely on the guards.

## 6. Backups

- [ ] Turn on backups for the production Postgres (Postgres service → Backups; depends on the Railway plan) with a daily schedule.
- [ ] Restore one backup once, into a scratch environment, to know the steps work before they're needed.

## 7. Smoke check after the first deploy

- [ ] `GET /health` → `{ ok: true, db: "ok" }`.
- [ ] `GET /auth/signup-options` → `codeRequired: true`, `demoAvailable: false`.
- [ ] `POST /demo/sandbox` → 404.
- [ ] Sign up yourself with the code, fill in the profile, answer the compatibility questions (checks they were seeded), create a household and try each module. Matches is empty: there are no other users yet, and that's expected.
- [ ] Log in to staging with the same browser and check it doesn't share the session (different `JWT_SECRET`, and each frontend has its own `localStorage`).

## 8. Before inviting the household

- [ ] Know how to reset a forgotten password (the app has no reset and sends no email): with the same temporary `.env.production` as `seed:questions`, `$env:DOTENV_CONFIG_PATH=".env.production"; npm run reset-password -- <email or username>` sets a random password and prints it once. Send it privately; they change it on their Profile page.
- [ ] A short notice for testers: it's a test, what is stored (profile, birth date, answers, household data, chat), who sees it, that you delete their data on request, and how to reach you.
- [ ] Check the testers are adults; signup has no minimum age yet.
- [ ] Tell them how to join: the join code, or an invite to the exact email they sign up with (invites only appear in the app's inbox; nothing is mailed). Sessions last 7 days, then they log in again.
- [ ] Decide where feedback goes.
