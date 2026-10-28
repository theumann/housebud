"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { useChatroomsFeed } from "@/context/ChatroomsFeedContext";
import { useHouseholdInvites } from "@/context/HouseholdInvitesContext";
import { useOptionalCurrentHousehold } from "@/context/CurrentHouseholdContext";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { useMenuDismiss } from "@/hooks/useMenuDismiss";
import { matchingEnabled } from "@/lib/features";

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
  { path: "chat", label: "Chat", setting: "chatEnabled" },
  { path: "chores", label: "Chores", setting: "choresEnabled" },
  { path: "shopping", label: "Shopping", setting: "shoppingEnabled" },
  { path: "expenses", label: "Expenses", setting: "expensesEnabled" },
  { path: "rules", label: "House rules", setting: "rulesEnabled" },
  { path: "calendar", label: "Calendar", setting: "calendarEnabled" },
] as const;

// On narrow windows a row of more than NARROW_ROW + 1 pages keeps the first
// NARROW_ROW and puts the rest under "More", so none (or its badge) is off-screen.
const NARROW_ROW = 3;

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
      className={clsx(pillClass(active), className)}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex items-center gap-2">
        <span>{link.label}</span>
        <NavBadge count={link.badge ?? 0} testId={`${link.testId}-badge`} />
      </span>
    </Link>
  );
}

const pillClass = (active: boolean) =>
  clsx(
    "rounded-full px-3 py-1",
    active
      ? "bg-primary-100 text-primary-700 font-semibold dark:bg-primary-600/20 dark:text-primary-100"
      : "text-muted hover:bg-surface-muted",
  );

function ChevronDown() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// The pages that don't fit in the row on narrow windows. Shown as active
// while one of them is open, with the badges of the pages it holds.
function MoreMenu({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, close, container, button);

  const badge = links.reduce((sum, l) => sum + (l.badge ?? 0), 0);
  const active = links.some((l) => isActive(pathname, l));

  return (
    <div ref={container} className="relative shrink-0 sm:hidden">
      <button
        ref={button}
        type="button"
        data-testid="nav-more"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(pillClass(active), "whitespace-nowrap")}
      >
        <span className="inline-flex items-center gap-1">
          More
          <ChevronDown />
          <NavBadge count={badge} testId="nav-more-badge" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          data-testid="nav-more-items"
          className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-lg border border-border-subtle bg-surface py-1 text-sm shadow-lg"
        >
          {links.map((link) => {
            const current = isActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                data-testid={`${link.testId}-more`}
                aria-current={current ? "page" : undefined}
                onClick={close}
                className={clsx(
                  "flex items-center justify-between gap-2 px-4 py-2 hover:bg-surface-muted",
                  current
                    ? "font-semibold text-primary-700 dark:text-primary-400"
                    : "text-foreground-soft",
                )}
              >
                {link.label}
                <NavBadge
                  count={link.badge ?? 0}
                  testId={`${link.testId}-more-badge`}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { pendingInvitesCount, unreadRoomsCount } = useChatroomsFeed();
  const totalBadgeCount = pendingInvitesCount + unreadRoomsCount;
  const {
    invites: householdInvites,
    unreadMessages,
    pendingRules,
  } = useHouseholdInvites();
  // Badges count chats with something new, like the matching Chat link, not
  // messages.
  const unreadChats = Object.values(unreadMessages).filter((n) => n > 0).length;
  const allPendingRules = Object.values(pendingRules).reduce(
    (sum, n) => sum + n,
    0,
  );
  const currentHousehold = useOptionalCurrentHousehold()?.household;

  const inMatching = matchingPaths.some((p) => pathname.startsWith(p));
  const inHousehold = pathname.startsWith("/household");

  const sections: (NavLink & { active: boolean })[] = [
    ...(matchingEnabled
      ? [
          {
            href: "/matches",
            label: "Find Roommates",
            testId: "nav-find-roommates",
            // Inside the section the Chat link carries the same count.
            badge: inMatching ? 0 : totalBadgeCount,
            active: inMatching,
          },
        ]
      : []),
    {
      href: "/household",
      label: "Household",
      testId: "nav-household",
      // Inside the section the Chat and House rules links carry these.
      badge:
        householdInvites.length +
        (inHousehold ? 0 : unreadChats + allPendingRules),
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
            badge:
              m.path === "chat"
                ? unreadMessages[currentHousehold.id]
                  ? 1
                  : 0
                : m.path === "rules"
                  ? (pendingRules[currentHousehold.id] ?? 0)
                  : 0,
          })),
      ]
    : [];

  const subLinks = inMatching
    ? matchingLinks
    : inHousehold
      ? householdLinks
      : [];
  // Index of the first page that goes under "More" on narrow windows.
  const overflowAt = subLinks.length > NARROW_ROW + 1 ? NARROW_ROW : Infinity;

  return (
    <nav className="sticky top-0 z-20 border-b border-border-subtle bg-linear-to-r from-nav-from/90 to-nav-to/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="HouseBud home">
            <Logo
              markTestId="nav-logo"
              wordmarkTestId="nav-title"
              wordmarkClassName="hidden sm:inline"
            />
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

        <AccountMenu />
      </div>

      {/* Pages of the current section */}
      {subLinks.length > 0 && (
        <div
          data-testid="nav-section-links"
          className="border-t border-border-subtle bg-linear-to-r from-theme-from to-theme-to"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 text-[11px] sm:gap-2 sm:text-xs">
            <div className="flex min-w-0 gap-1 overflow-x-auto sm:gap-2">
              {subLinks.map((link, i) => (
                <NavPill
                  key={link.href}
                  link={link}
                  active={isActive(pathname, link)}
                  className={clsx(
                    "whitespace-nowrap",
                    i >= overflowAt && "max-sm:hidden",
                  )}
                />
              ))}
            </div>
            {overflowAt !== Infinity && (
              <MoreMenu
                links={subLinks.slice(overflowAt)}
                pathname={pathname}
              />
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
