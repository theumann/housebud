import { matchingEnabled } from "@/lib/features";

// What people accept at signup, and again whenever it changes: after editing
// what it says, bump NOTICE_VERSION in backend/src/modules/auth/auth.types.ts
// and the date below, so everyone is asked to read it again.
export const NOTICE_UPDATED = "7 November 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

const list = "list-disc space-y-1 pl-5";
const link =
  "font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400";

export function TesterNotice() {
  return (
    <div
      data-testid="tester-notice"
      className="space-y-5 text-sm leading-relaxed text-foreground-soft"
    >
      <p>
        HouseBud is an app for running a shared home: chores, a shopping list,
        shared expenses, house rules, a calendar and a household chat. You’re
        one of the first people using it for real, so a few things to know
        first.
      </p>

      <Section title="It’s a test">
        <p>
          The app works, but expect rough edges, and tell me about them.
          Features may change, and I may need to fix or reset things. If
          something important goes wrong (wrong amounts in expenses, for
          example), let me know rather than working around it.
        </p>
      </Section>

      <Section title="What the app stores about you">
        <ul className={list}>
          <li>
            Your account: email address, username, name, birth date, school and
            year, the city and ZIP code you’re looking in, and your password
            (stored scrambled, so nobody can read it, me included).
          </li>
          <li>
            What you add to your profile: a display name, a short bio, a photo
            link.
          </li>
          {matchingEnabled && (
            <li>
              Your answers to the compatibility questions, if you fill them in.
            </li>
          )}
          <li>
            What you do in your household: chores, shopping items, expenses and
            payments, house rules and votes, calendar entries, and chat
            messages.
          </li>
          <li>
            When a login or signup fails (a wrong password, for example): the
            internet address it came from, kept for a day, to stop people
            guessing passwords.
          </li>
          <li>
            Problem reports you send with the bug icon: your description, the
            page you were on, your browser and screen size, and, unless you
            untick it, a screenshot of that page. The screenshot shows the page
            as you saw it, so it can include housemates’ names and messages. It
            never shows anything outside the app.
          </li>
        </ul>
      </Section>

      <Section title="Who sees it">
        <ul className={list}>
          <li>
            <strong>Your household</strong> sees your name and photo, and
            everything you add in the household (chores, expenses, chat…).
            People who join later don’t see chat messages from before they
            joined.
          </li>
          <li>
            {matchingEnabled ? (
              <>
                <strong>Other users</strong> looking in the same area see your
                profile card (name, age, school, photo) and your compatibility
                with them.
              </>
            ) : (
              <>
                <strong>Nobody else</strong> sees your profile.
              </>
            )}
          </li>
          <li>
            <strong>Me</strong>, as the person running the app: I can access the
            database to fix problems and to take backups. I won’t look at your
            household’s content unless you ask me to, or to fix something you
            reported. Problem reports, screenshots included, are seen by me
            only.
          </li>
        </ul>
      </Section>

      <Section title="Where it’s kept">
        <p>
          On Railway’s servers, where the app runs. I keep private backup
          copies, which I delete when they’re no longer needed, and I save the
          screenshots from problem reports privately on my computer to look at
          them. When something in the app breaks, an error report goes to
          Sentry, an error-tracking service: what failed, on which page, your
          browser, and the internal number of your account, but not your name,
          email address or anything you wrote.
        </p>
      </Section>

      <Section title="What the app doesn’t do">
        <p>
          It sends no email, shows no ads, has no tracking or analytics (only
          the error reports above), and your data isn’t sold or shared with
          anyone.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className={list}>
          <li>
            You can change your profile and password at any time (Profile page).
          </li>
          <li>
            To have your account and data deleted, problem reports included, ask
            me:{" "}
            <a href="mailto:privacy@housebud.app" className={link}>
              privacy@housebud.app
            </a>
            . The app can’t do it by itself yet, so I’ll do it by hand and
            confirm when it’s done. Expenses and payments you shared with
            housemates stay in the household’s records under an anonymous name,
            so their balances stay right; everything else is deleted. Settle any
            open balance with your housemates first.
          </li>
          <li>
            Forgot your password? Ask me and I’ll set a temporary one for you to
            change.
          </li>
        </ul>
      </Section>

      <Section title="Age">
        <p>You must be 18 or older to use HouseBud.</p>
      </Section>

      <Section title="Questions and problems">
        <p>
          Use the bug icon at the top of every page. If you can’t log in or the
          app won’t load, write to{" "}
          <a href="mailto:contact@housebud.app" className={link}>
            contact@housebud.app
          </a>
          .
        </p>
      </Section>

      <p className="text-xs text-subtle">Last updated {NOTICE_UPDATED}.</p>
    </div>
  );
}
