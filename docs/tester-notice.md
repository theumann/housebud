# HouseBud tester notice

The tester notice is in the app (since 2026-11-07): `frontend/src/components/notice/TesterNotice.tsx`. Everyone accepts it at signup (a required checkbox), accounts from before it accept it on their next visit, and anyone can read it at [housebud.app/about](https://housebud.app/about), logged in or not (About in the account menu). After changing what it says, bump `NOTICE_VERSION` in `backend/src/modules/auth/auth.types.ts` and `NOTICE_UPDATED` in the component: everyone is asked to accept it again. The app records who accepted which version and when (`User.noticeVersion`, `noticeAcceptedAt`), so copies of sent notices are no longer needed.

Signup refuses anyone under 18, so the parent or guardian agreement this file used to hold is gone. Bring one back with the notice when younger testers are let in.

## Invite message

Fill in the bracketed parts. Keep a list of who got the code and when, outside the repo.

---

Hi [name],

You're invited to try HouseBud, an app for running a shared home: chores, a shopping list, shared expenses, house rules, a calendar and a household chat. It's a test version that I run myself.

Sign up at https://housebud.app/signup?code=[code] (the link fills in the invite code). You must be 18 or older. Before signing up, the app shows a short notice about what it stores and who sees it: your housemates see what you add to the household, nobody else does, and nothing is sold or used for ads. You can read it any time at https://housebud.app/about. To have your account and data deleted, email privacy@housebud.app.

Then join your household: enter its join code (the owner finds it on the household page), or have the owner invite the exact email address you signed up with (the invitation appears in the app; no email is sent).

Something broken? Use the bug icon at the top of every page, or write to contact@housebud.app if you can't log in.

---
