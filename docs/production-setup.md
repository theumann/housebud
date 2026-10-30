# Production (Railway)

How production was set up (2026-10-26), how to release to it and back it up, and what's left before the first household is invited. Staging stays as it is: demo users, "Try the demo", reseeded when needed. Production holds real people's data and none of that.

## What runs where

| Service       | Railway name    | Address                                                                                                     |
| ------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| Frontend      | `prod-frontend` | [housebud.app](https://housebud.app) (`www.` redirects there; also housebud-production-ecd6.up.railway.app) |
| Backend       | `prod-backend`  | [api.housebud.app](https://api.housebud.app) (also housebud-production.up.railway.app)                      |
| Postgres (18) | `prod-postgres` | Private only: `postgres-frit.railway.internal` (keeps the name it was created with). TCP proxy normally off |

All three are in the Railway project's `production` environment. Service names are unique across the project's environments, hence the `prod-` prefix (staging has `backend`, `frontend`, `Postgres`). Both apps deploy the `production` branch.

## Releasing

Staging deploys every merge to `main`; production only moves when you push the `production` branch, to a commit that has already run on staging:

```
git push origin main:production        # or <commit>:production
```

The `main` ruleset doesn't cover this branch, so no PR is needed. The "Prod" ruleset guards it instead: GitHub refuses the push unless the commit passed all five CI checks (on `main`), and it blocks force pushes and deleting the branch. Railway's "Wait for CI" doesn't hold production deploys back, since no workflow runs on `production` pushes, so the ruleset is the real guard. Follow a deploy in GitHub's deployments (environment "HouseBud / production") or Railway's deploy log. If the release includes a migration, take a backup first (below), then watch `prod-backend`'s deploy log for the migrations being applied.

## Backups

The current Railway plan has no Postgres backups (scheduled backups need Pro), so for now they're manual `pg_dump`s: **weekly, and before every release that includes a migration.** Move to a plan with scheduled backups once more than one household depends on the app.

`pg_dump` must be at least the server's major version (18). Dumps contain everyone's data (profiles, chats, expenses), so keep them in a private folder outside the repo and delete old ones.

**Take a backup** (PowerShell, from `backend/`):

1. Turn on `prod-postgres`'s TCP proxy (Settings → Networking) and copy the full URL from **Connect → Public Network**, not the `${{…}}` template in Variables.
2. Put it in `backend/.env.production` (gitignored) as `DATABASE_URL=<url>`, without spaces.
3. Run:
   ```
   $url = (Get-Content .env.production | Select-String '^DATABASE_URL=').Line.Substring(13)
   pg_dump --format=custom --no-owner --file "$HOME\HouseBud-backups\housebud-prod-$(Get-Date -Format yyyy-MM-dd-HHmm).dump" $url
   ```
4. Turn the proxy off again and empty the URL in the file. The proxy address changes every time it's turned on.

**Restore**: test it into a scratch local database (`createdb housebud_restore_test`, then `pg_restore --no-owner --dbname <local url>/housebud_restore_test <file>`) before you ever need it on production. Use a local PostgreSQL 18 (`pg_restore` must be at least the dump's version), not the Docker dev database on port 5433 (Postgres 16); drop the scratch database afterwards. On production, `pg_restore --clean --if-exists --no-owner --dbname $url <file>` replaces the current data: take a fresh dump first, and do it while nobody is using the app.

## Forgotten passwords

The app has no reset and sends no email. With the URL in `.env.production` as for a backup, from `backend/`: `$env:DOTENV_CONFIG_PATH=".env.production"; npm run reset-password -- <email or username>` sets a random password and prints it once. Send it privately; they change it on their Profile page.

## Deleting an account

On request (the tester notice promises it), take a backup, then with the URL in `.env.production`, from `backend/`: `$env:DOTENV_CONFIG_PATH=".env.production"; npm run delete-user -- <email or username>`. It prints what will happen (households deleted or handed over, delete or anonymize) and asks for a `y`. Someone with expenses or payments shared with housemates is anonymized, so the others' balances don't change. Confirm to the person when it's done, and delete their screenshots from `~/HouseBud-feedback`.

## Reading feedback

"Report a problem" (the bug icon in the nav) stores reports in the database. With the URL in `.env.production` as for a backup, from `backend/`: `$env:DOTENV_CONFIG_PATH=".env.production"; npm run feedback` prints the 20 newest and saves their screenshots to `~/HouseBud-feedback` (`npm run feedback -- --all` for every report). Screenshots show what was on the tester's screen, housemates' messages included: keep that folder private and delete old ones.

## Setup checklist

### 1. Environment and database

- [x] A new environment `production`, started empty rather than duplicating staging, so no staging variable (`DEMO_SANDBOX`, `SIGNUP_CODE`, the database URL) comes along.
- [x] A Postgres service, TCP proxy off except while seeding or backing up.
- [x] No `housebud:staging` comment on this database: `seed:demo` refuses to run without it, which is the point.

### 2. Backend service

- [x] Source: this repo, branch `production`, root directory `backend`.
- [x] Build `npm run build` (it runs `prisma generate`, then `tsc`), start `npm start`.
- [x] Pre-deploy command `npx prisma migrate deploy` (never `migrate dev` or `db push`). `prisma` is a devDependency that the build and the pre-deploy command both need; the first deploy's log showed the client generated and all 15 migrations applied.
- [x] Health check path `/health`.

Variables:

| Variable           | Value                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | Reference to the production Postgres's private URL, by its service name (`${{prod-postgres.DATABASE_URL}}`; pick it from the reference dropdown)                                    |
| `JWT_SECRET`       | New random value, never staging's: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. A shared secret would let staging tokens log in to production  |
| `SIGNUP_CODE`      | New code, different from staging's (the staging one has been handed out with the demo)                                                                                              |
| `NODE_ENV`         | `production` (the seed scripts refuse to run with it)                                                                                                                               |
| `DEMO_SANDBOX`     | **Not set.** Never `true` in production                                                                                                                                             |
| `FEATURE_MATCHING` | `false` while matching is closed in production (planned to open toward the end of the school year). Pair it with the frontend's `NEXT_PUBLIC_FEATURE_MATCHING`; set both or neither |

`PORT` is provided by Railway.

### 3. Frontend service

- [x] Source: this repo, branch `production`, root directory `frontend`. Build `npm run build`, start `npm start`.
- [x] `NEXT_PUBLIC_API_BASE_URL` = the backend's full public URL **including `https://`** and without a trailing `/`, set before the first build: Next bakes it into the bundle, so changing it needs a redeploy. Without the scheme the build fails with `TypeError: Invalid URL` from `next.config.ts`.
- [x] Public domains for both services (`*.up.railway.app`).
- [x] Custom domain `housebud.app` (and `www.housebud.app`) on prod-frontend, port 8080, DNS at Namecheap: an ALIAS record for `@` (the root can't be a CNAME), a CNAME for `www`, and Railway's `_railway-verify` TXT record, which stays. Railway issues and renews the certificate. `next.config.ts` redirects any `www.` address to the bare domain, since the login token is stored per address.
- [x] `api.housebud.app` on prod-backend (CNAME `api`), then `NEXT_PUBLIC_API_BASE_URL=https://api.housebud.app` on prod-frontend and a redeploy.
- [x] `NEXT_PUBLIC_FEATURE_MATCHING=false` while matching is closed, with the backend's `FEATURE_MATCHING=false`. Baked in at build time: changing it needs a redeploy. With it off, the matching pages redirect to `/household`.
- [ ] Optional: health check path `/login`, so a new deploy only takes traffic once a page loads.

### 4. Deploy trigger

- [x] A `production` branch, connected to both apps (service Settings → Source → branch).
- [x] Ruleset "Prod" on `production`: the five CI checks must have passed on the commit; no force push, no deletion.
- [x] "Wait for CI" on as well, though it doesn't hold these deploys (no workflow runs on `production` pushes).

### 5. Data

- [x] `seed:questions` once (35 questions), through the TCP proxy as for a backup: `$env:DOTENV_CONFIG_PATH=".env.production"; npm run seed:questions`.
- [ ] Never run `seed:users`, `seed:demo` or `seed:e2e` against production. `seed-dev.ts` refuses non-localhost databases and `seed-demo.ts` needs the staging marker, but don't rely on the guards.

### 6. Backups

- [x] First manual backup, and one test restore into a local scratch database (see Backups above).
- [ ] Later: a Railway plan with scheduled backups.

### 7. Smoke check after the first deploy

- [x] `GET /health` → `{ ok: true, db: "ok" }`.
- [x] `GET /auth/signup-options` → `codeRequired: true`, `demoAvailable: false`.
- [x] `POST /demo/sandbox` → 404.
- [x] Sign up with the code, fill in the profile, answer the compatibility questions, create a household and try each module. Matches is empty: there are no other users yet.
- [x] Staging and production don't share a session (different `JWT_SECRET`, and each frontend has its own `localStorage`).

A console error "A listener indicated an asynchronous response by returning true…" on a new domain comes from a browser extension, not the app: it disappears in an Incognito window.

### 8. Before inviting the household

- [ ] Know how to reset a forgotten password (above).
- [ ] Send the tester notice, with the parent or guardian agreement for anyone under 18. The copy sent is kept outside the repo; before each new tester, check it against `docs/tester-notice.md` (the reference, updated with the app) and bring it up to date.
- [ ] Check each tester's age; signup has no minimum age yet. Under 18: the parent or guardian agreement in the notice, household features only, and matching closed or limited to people you invited (see "Minimum age" in `CLAUDE.md`).
- [ ] Tell them how to join: the join code, or an invite to the exact email they sign up with (invites only appear in the app's inbox; nothing is mailed). Sessions last 7 days, then they log in again.
- [ ] Decide where feedback goes.
