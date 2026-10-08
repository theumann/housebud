"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { useChatroomsFeed } from "@/context/ChatroomsFeedContext";
import { getUserDisplayName } from "@/lib/displayName";
import { useTheme } from "@/hooks/useTheme";
import { useHouseholdInvites } from "@/context/HouseholdInvitesContext";
import { useOptionalCurrentHousehold } from "@/context/CurrentHouseholdContext";

function NavBadge({ count, testId }: { count: number; testId?: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

type NavLink = {
  href: string;
  label: string;
  testId: string;
  exact?: boolean;
  badge?: number;
};

// Household module pages, shown while the module is turned on.
const householdModules = [
  { path: "chores", label: "Chores", setting: "choresEnabled" },
  { path: "shopping", label: "Shopping", setting: "shoppingEnabled" },
] as const;

// Planned household modules, shown disabled until they're built.
const upcomingHouseholdModules = [
  { path: "chat", label: "Chat" },
  { path: "expenses", label: "Expenses" },
  { path: "calendar", label: "Calendar" },
  { path: "rules", label: "House rules" },
] as const;

const matchingPaths = [
  "/matches",
  "/shortlist",
  "/compatibility",
  "/chatrooms",
];

function isActive(pathname: string, link: NavLink) {
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

function NavPill({
  link,
  active,
  className,
}: {
  link: NavLink;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={link.href}
      data-testid={link.testId}
      className={clsx(
        "rounded-full px-3 py-1",
        active
          ? "bg-primary-100 text-primary-600 font-semibold dark:bg-primary-600/20 dark:text-primary-100"
          : "text-gray-600 hover:bg-surface-muted dark:text-slate-400",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex items-center gap-2">
        <span>{link.label}</span>
        <NavBadge count={link.badge ?? 0} testId={`${link.testId}-badge`} />
      </span>
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { pendingInvitesCount, unreadRoomsCount } = useChatroomsFeed();
  const totalBadgeCount = pendingInvitesCount + unreadRoomsCount;
  const householdInvitesCount = useHouseholdInvites().invites.length;
  const currentHousehold = useOptionalCurrentHousehold()?.household;
  const { isDark, toggle } = useTheme();

  const inMatching = matchingPaths.some((p) => pathname.startsWith(p));
  const inHousehold = pathname.startsWith("/household");

  const sections: (NavLink & { active: boolean })[] = [
    {
      href: "/matches",
      label: "Find Roommates",
      testId: "nav-find-roommates",
      // Inside the section the Chat link carries the same count.
      badge: inMatching ? 0 : totalBadgeCount,
      active: inMatching,
    },
    {
      href: "/household",
      label: "Household",
      testId: "nav-household",
      badge: householdInvitesCount,
      active: inHousehold,
    },
  ];

  const matchingLinks: NavLink[] = [
    { href: "/matches", label: "Matches", testId: "nav-matches" },
    { href: "/shortlist", label: "Shortlist", testId: "nav-shortlist" },
    {
      href: "/compatibility",
      label: "Compatibility",
      testId: "nav-compatibility",
    },
    {
      href: "/chatrooms",
      label: "Chat",
      testId: "nav-chat",
      badge: totalBadgeCount,
    },
  ];

  // Household pages depend on which household is open and which modules it
  // has turned on.
  const householdLinks: NavLink[] = currentHousehold
    ? [
        {
          href: `/household/${currentHousehold.id}`,
          label: "Overview",
          testId: "nav-household-overview",
          exact: true,
        },
        ...householdModules
          .filter((m) => currentHousehold.settings[m.setting])
          .map((m) => ({
            href: `/household/${currentHousehold.id}/${m.path}`,
            label: m.label,
            testId: `nav-household-${m.path}`,
          })),
      ]
    : [];

  const subLinks = inMatching
    ? matchingLinks
    : inHousehold
      ? householdLinks
      : [];

  return (
    <nav className="sticky top-0 z-20 mb-4 border-b border-border-subtle bg-gradient-to-r from-nav-from/90 to-nav-to/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span
              data-testid="nav-logo"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
            >
              BB
            </span>
            <span
              data-testid="nav-title"
              className="hidden text-sm font-semibold tracking-tight sm:inline"
            >
              Bunkbuddy
            </span>
          </Link>
        </div>

        {/* Sections */}
        <div className="flex gap-1 text-xs sm:gap-2">
          {sections.map((section) => (
            <NavPill
              key={section.href}
              link={section}
              active={section.active}
            />
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 text-xs">
          {user && (
            <Link
              href="/profile"
              data-testid="nav-profile"
              className="hidden text-gray-600 dark:text-slate-400 underline-offset-2 hover:underline sm:inline"
            >
              {user
                ? `Hi, ${getUserDisplayName({
                    username: user.username,
                    profile: {
                      displayName: user.profile?.displayName,
                      firstName: user.profile?.firstName,
                      lastName: user.profile?.lastName,
                    },
                  })}`
                : ""}
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-700 dark:text-slate-300 hover:bg-surface-muted"
            data-testid="toggle-theme"
            aria-label="Toggle theme"
            onClick={toggle}
          >
            {isDark ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="3" r="1.5" />
                <circle cx="12" cy="21" r="1.5" />
                <circle cx="3" cy="12" r="1.5" />
                <circle cx="21" cy="12" r="1.5" />
                <circle cx="5.6" cy="5.6" r="1.5" />
                <circle cx="18.4" cy="18.4" r="1.5" />
                <circle cx="5.6" cy="18.4" r="1.5" />
                <circle cx="18.4" cy="5.6" r="1.5" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </Button>
          <Button
            data-testid="logout-button"
            variant="ghost"
            size="sm"
            className="text-gray-700 dark:text-slate-300 hover:bg-surface-muted"
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Pages of the current section */}
      {subLinks.length > 0 && (
        <div
          data-testid="nav-section-links"
          className="border-t border-border-subtle bg-gradient-to-r from-theme-from to-theme-to"
        >
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 text-[11px] sm:gap-2 sm:text-xs">
            {subLinks.map((link) => (
              <NavPill
                key={link.href}
                link={link}
                active={isActive(pathname, link)}
                className="whitespace-nowrap"
              />
            ))}
            {inHousehold &&
              currentHousehold &&
              upcomingHouseholdModules.map((m) => (
                <span
                  key={m.path}
                  data-testid={`nav-household-${m.path}-soon`}
                  title="Coming soon"
                  aria-disabled="true"
                  className="inline-flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-gray-400 dark:text-slate-600"
                >
                  <span>{m.label}</span>
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-500 dark:text-slate-400">
                    soon
                  </span>
                </span>
              ))}
          </div>
        </div>
      )}
    </nav>
  );
}
