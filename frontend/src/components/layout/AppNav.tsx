"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { useChatroomsFeed } from "@/context/ChatroomsFeedContext";
import { getUserDisplayName } from "@/lib/displayName";
import { useTheme } from "@/hooks/useTheme";

const links = [
  { href: "/matches", label: "Matches" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/compatibility", label: "Compatibility" },
  { href: "/chatrooms", label: "Chat" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth() as any; // adjust if your AuthContext typing is stricter
  const { pendingInvitesCount, unreadRoomsCount } = useChatroomsFeed();
  const totalBadgeCount = pendingInvitesCount + unreadRoomsCount;
  const { isDark, toggle } = useTheme();

  const handleLogout = async () => {
    // If you already have a logout() in AuthContext, this will call it.
    // If not, you can replace this with whatever you're doing now.
    if (logout) {
      await logout();
    } else {
      // Fallback: clear token & go to login (only if needed)
      router.push("/login");
    }
  };

  return (
    <nav className="sticky top-0 z-20 mb-4 border-b border-border-subtle bg-gradient-to-r from-nav-from/90 to-nav-to/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/matches" className="flex items-center gap-2">
            <span
              data-testid="nav-logo"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
            >
              BB
            </span>
            <span
              data-testid="nav-title"
              className="text-sm font-semibold tracking-tight"
            >
              Bunkbuddy
            </span>
          </Link>
        </div>

        {/* Links */}
        <div className="hidden gap-2 text-xs sm:flex">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-testid={`nav-${link.label.toLowerCase()}`}
                className={clsx(
                  "rounded-full px-3 py-1",
                  active
                    ? "bg-primary-100 text-primary-600 font-semibold dark:bg-primary-600/20 dark:text-primary-100"
                    : "text-gray-600 hover:bg-surface-muted dark:text-slate-400",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative inline-flex items-center gap-2">
                  <span>{link.label}</span>
                  {link.href === "/chatrooms" && totalBadgeCount > 0 && (
                    <span
                      data-testid="nav-chat-badge"
                      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
                    >
                      {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
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
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile secondary nav */}
      <div className="flex border-t border-border-subtle bg-gradient-to-r from-theme-from to-theme-to px-2 py-2 text-[11px] sm:hidden">
        <div className="flex w-full items-center justify-between gap-1">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex-1 rounded-full px-2 py-1 text-center",
                  active
                    ? "bg-primary-100 text-primary-600 font-semibold dark:bg-primary-600/20 dark:text-primary-100"
                    : "text-gray-600 hover:bg-surface-muted dark:text-slate-400",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative inline-flex items-center gap-2">
                  <span>{link.label}</span>
                  {link.href === "/chatrooms" && pendingInvitesCount > 0 && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
