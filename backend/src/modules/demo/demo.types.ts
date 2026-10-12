// Seeded demo users (scripts/seed-demo.ts): reserved domain, nobody logs in.
export const DEMO_EMAIL_DOMAIN = "demo.example.com";

// Throwaway accounts created by "Try the demo". Matches never shows them.
export const SANDBOX_EMAIL_DOMAIN = "sandbox.example.com";

// A sandbox (and its login) lasts this long; older ones are removed whenever a
// new one is created, so no scheduled job is needed.
export const SANDBOX_LIFETIME_HOURS = 24;

// Each sandbox is several rows; this bounds what a bot hammering the button
// can create.
export const SANDBOX_HOURLY_CAP = 60;
