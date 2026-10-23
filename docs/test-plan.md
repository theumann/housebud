# HouseBud test plan

How HouseBud is tested: what is covered and by which kind of test, what deliberately isn't, which risks drive the choices, and what a change has to pass before it ships.

Last updated: 2026-10-22.

## 1. Scope

HouseBud helps students find roommates and then run the household they form. One web app (Next.js frontend, Express + Prisma API, PostgreSQL) covers both halves:

- **Finding roommates:** sign up and log in, profile, compatibility questions, matches, shortlist, chat rooms with invites.
- **Running a household:** creating one from a chat room or from scratch, joining by code or invite, owner management, and six modules: chat, chores, shopping list, expenses, house rules and calendar.

This plan covers that application as it runs in development, CI and the staging environment on Railway. Nothing is in production yet.

## 2. Test levels

| Level                | Tool                                                         | What it checks                                                                                                                               | Size                                                                | Runs                                           |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Unit                 | Vitest (`backend/tests/unit/`)                               | Pure business rules: chore repeat steps and next due dates, rotation turns, calendar repeats, equal splits, balances and suggested transfers | 44 tests, ~5 s, no database                                         | Every push (CI checks job), locally on demand  |
| API integration      | Vitest + Supertest against PostgreSQL (`backend/tests/api/`) | Every endpoint: validation, permissions (401/403/404), state changes, the rules each module is built on                                      | ~150 tests in 13 files                                              | Every push (CI), with coverage                 |
| End-to-end           | Playwright (`frontend/tests/e2e/`)                           | User flows in a real browser against a production build: the backend, frontend and database together                                         | 52 scenarios on every project, plus 1 desktop-only and 2 phone-only | Every push (CI, one job per engine)            |
| Accessibility        | axe-core via Playwright (`accessibility.spec.ts`)            | WCAG 2.1 A and AA on 15 pages, in light and dark mode                                                                                        | 30 scans × 2 projects                                               | Every push (CI, Chromium job)                  |
| Manual / exploratory | The owner, on Windows and an Android phone                   | New features before merge, look and feel, things automation can't judge                                                                      | —                                                                   | Per feature; on staging before sharing a build |

### Browsers and devices

End-to-end tests run on five Playwright projects:

| Project     | Engine                   | Viewport       |
| ----------- | ------------------------ | -------------- |
| `chromium`  | Chromium                 | Desktop        |
| `firefox`   | Firefox                  | Desktop        |
| `webkit`    | WebKit (Safari's engine) | Desktop        |
| `pixel-7`   | Chromium                 | Emulated phone |
| `iphone-14` | WebKit                   | Emulated phone |

The phones are **emulated** (viewport, touch, user agent on the matching engine), not real devices. Manual testing covers a real Android phone; there is no real iPhone or Mac, so WebKit in CI is the only Safari and iOS coverage. A failure that only happens on WebKit is treated as a likely real Safari bug, not noise (see section 9).

Accessibility scans run on `chromium` and `pixel-7` only: axe's rules don't depend on the engine, and those two cover the desktop and phone layouts.

## 3. Coverage of features

| Feature                                       | Unit | API | E2E | Notes                                                                                          |
| --------------------------------------------- | ---- | --- | --- | ---------------------------------------------------------------------------------------------- |
| Sign up, log in, sessions                     |      | ✓   | ✓   | Invite code, demo off, invalid token, dropped profile request                                  |
| Profile, compatibility                        |      | ✓   | ✓   |                                                                                                |
| Matches, shortlist                            |      | ✓   | ✓   | Pagination, invites from Matches                                                               |
| Chat rooms (matching)                         |      | ✓   | ✓   | Invites, re-invites, forming a household; owner handover when the owner leaves has no test yet |
| Household: create, join, invites, owner tools |      | ✓   | ✓   | In-app and email-token invites, remove, transfer, leave                                        |
| Chat room → household                         |      | ✓   | ✓   | Owner only, consent of each invitee                                                            |
| Household chat                                |      | ✓   | ✓   | Join-date visibility, unread counts                                                            |
| Chores                                        | ✓    | ✓   | ✓   | Repeat rules and turns in unit tests; start, done, undo end to end                             |
| Shopping list                                 |      | ✓   | ✓   | Turning the module off                                                                         |
| Expenses                                      | ✓    | ✓   | ✓   | Split and balance maths in unit tests; settle-up end to end                                    |
| House rules                                   |      | ✓   | ✓   | Proposals, votes, newcomers agreeing                                                           |
| Calendar                                      | ✓    | ✓   | ✓   | Repeats in unit tests; events, skips, away entries end to end                                  |
| Navigation (desktop and phone "More" menu)    |      |     | ✓   | Badges included                                                                                |
| Seeded demo household                         |      |     | ✓   | Read-only smoke test of every module's states                                                  |
| Demo sandbox (staging)                        |      | ✓   | ✓   | Off in tests, as in production                                                                 |
| Accessibility                                 |      |     | ✓   | Every main page, both themes                                                                   |

**Code coverage** (backend `src/`, unit and API tests together, measured in CI):

|            | Measured | Threshold (CI fails below) |
| ---------- | -------- | -------------------------- |
| Statements | 89.5%    | 87%                        |
| Branches   | 81.9%    | 79%                        |
| Functions  | 96.6%    | 94%                        |
| Lines      | 90.7%    | 88%                        |

The frontend has no coverage figure: its behaviour is tested end to end, and Playwright doesn't measure coverage.

## 4. Risks and how they're covered

Testing effort follows what would hurt users most.

| Risk                                             | Why it matters                                                                          | Covered by                                                                                                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Someone sees or changes another household's data | Privacy; households hold chats, money and schedules                                     | API tests in every module: non-members and former members get 404, items are looked up by id **and** household; turned-off modules return 404                                                                |
| Wrong money                                      | Balances and "who owes whom" must add up                                                | Unit tests on integer-cent splits (always add up to the total), balances (always sum to zero), transfers (always settle everyone); API tests on edit permissions                                             |
| Wrong dates                                      | Chores and events repeat on calendar rules (short months, leap years, late completions) | Unit tests on every repeat unit and edge; dates are calendar days with no time zone by design, and the client sends its local "today"                                                                        |
| Adding people without consent                    | Households and rooms are built from invites                                             | API and E2E tests: each invitee accepts or declines; only owners form households                                                                                                                             |
| Logged out or bounced by timing                  | Polling and async loading make races likely                                             | A regression test for a dropped profile request; the household-page bounce depends on response order, which no test can force, so the WebKit jobs are its coverage. Both were found by running more browsers |
| Unusable for some people                         | Contrast, names, keyboard and screen-reader access                                      | axe on every main page in both themes                                                                                                                                                                        |
| Breaks on Safari or iPhone                       | No real Apple device to test on                                                         | WebKit desktop and iPhone 14 in CI on every push                                                                                                                                                             |
| Tests that pass by luck                          | Shared data and parallel workers hide bugs                                              | Seed users are read-only; tests that change data use fresh users with their own ZIP prefix; 4+ parallel workers                                                                                              |

## 5. Not tested (and why)

| Area                                   | Why                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Real iOS/macOS devices                 | None available; WebKit emulation in CI is the stand-in                                                                                 |
| Load and performance                   | Student households are small; polling every 30 s is the known cost. A load test (e.g. k6) is on the roadmap                            |
| Security testing beyond access control | Permissions are tested (401/403/404) and the demo sandbox's rate limit (429), but there's no penetration test or dependency audit gate |
| Email                                  | The app sends no email yet; seed addresses are on domains that can't receive real mail                                                 |
| Visual regression                      | Layout and look are checked by hand; screenshot comparison is optional future work                                                     |
| Frontend components in isolation       | Behaviour is covered end to end instead; there are no React component tests                                                            |
| Seed and demo scripts                  | Development tools, not part of what's served; only `seed:demo`'s user generation has tests                                             |
| Production deployment                  | Not deployed yet; staging on Railway is checked by hand                                                                                |

## 6. Environments and test data

| Environment                               | Database                                       | Data                                                                    | Used for                               |
| ----------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| Local development                         | `bunkbuddy` (Docker Postgres)                  | `seed:users`: fake users, the seeded household                          | Manual testing, phone testing over LAN |
| API tests                                 | `bunkbuddy_test`, one schema per Vitest worker | Created per test (factory helpers), reset before each test              | Vitest `api` project                   |
| End-to-end                                | `e2e` schema of the dev database               | Reset and re-seeded at the start of every run; tests create fresh users | Playwright                             |
| CI (GitHub Actions, Ubuntu 24.04, pinned) | Throwaway Postgres 16 per job                  | As above                                                                | GitHub Actions                         |
| Staging                                   | Railway Postgres                               | Demo users (`seed:demo`), visitor sandboxes, invite-only sign-up        | Manual checks, sharing the demo        |

Seed users that tests read: `me1` (one chat room, no household), `me2` (no household), `me3` (at the 3-room limit), and `me4` + `me5` (the seeded household, with every module in every state). Tests never change them.

## 7. Entry and exit criteria

**A change is ready for testing when** it's on its own branch, builds locally, and any new behaviour has tests at the lowest level that can check it: a rule in a unit test, an endpoint in an API test, a user flow end to end. A new page or module also gets a line in the accessibility spec.

**A change can merge when**:

- All five required CI checks pass (format, types, lint and build; API tests with coverage; end-to-end on Chromium, Firefox and WebKit). `main` can't be pushed to directly, and the ruleset blocks a merge until they're green.
- Coverage is at or above the thresholds.
- axe reports no violations.
- A test that passed only on retry ("flaky") has been looked into, not just accepted (see section 9).
- Anything found and deliberately not fixed is written down (section 8).
- The owner has tried the feature by hand.

**A build is ready to share on staging when** `main` is green, migrations have been applied with `prisma migrate deploy`, and the demo sandbox has been tried by hand.

## 8. Defect tracking

Defects and deferred improvements live in [`known_bugs_and_improvements.md`](../known_bugs_and_improvements.md), in the repo next to the code:

- An entry is added when a bug is found and deliberately not fixed right away, with what happens and a proposed fix.
- It's removed in the same pull request that fixes it, so the file is always current and the PR shows the fix.
- A bug fixed as soon as it's found goes straight into a PR with a regression test. The PR description records what was found, how, and why it happened.

## 9. Flaky tests

In CI, Playwright retries a failed test once and reports it as "flaky" if the retry passes. A flaky test is treated as a defect to investigate, not a fluke to ignore. Two of the bugs this suite found started as tests that failed only some of the time on one engine:

- **Firefox:** a dropped `/profile/me` request sent the user to the login page although their session was still valid. The app now retries before giving up.
- **WebKit (CI):** opening a household page could bounce a member to Overview, because the page briefly read an empty household list loaded before login. Fixed in `useHouseholds`.

## 10. What testing has found so far

| Found by           | Defect                                                                      | Fix                                                                 |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| First CI run       | `seed:questions` only worked on Windows                                     | Made the script portable                                            |
| Firefox E2E        | Dropped profile request bounced users to login                              | `AuthContext` retries non-401 failures                              |
| WebKit E2E (CI)    | Household pages bounced members to Overview                                 | `useHouseholds` reports loading until loaded with the current login |
| WebKit E2E         | Test logins raced the login page's own redirect                             | Tests set the token on a static page                                |
| axe                | Grey text under 4.5:1 contrast in both themes; dark-mode teal text at 4.1:1 | Theme tokens retuned; new text colour for dark mode                 |
| axe                | Chat list "New" button named "Open chat" for screen readers                 | Name now starts with the visible word                               |
| Parallel E2E audit | Tests changing shared seed users could break each other                     | Fresh users per test, separate ZIP prefixes                         |

## 11. Keeping the plan current

This plan changes with the code: a new test level, environment, exclusion or criterion is updated here in the same pull request. Test counts and coverage figures are as of the date at the top; CI shows the live numbers (coverage in the API job's summary, HTML reports as artifacts).
