"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { useChatroomsFeed } from "@/context/ChatroomsFeedContext";

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
    <nav className="sticky top-0 z-20 mb-4 border-b border-border-subtle bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/matches" className="flex items-center gap-2">
            <span data-testid="nav-logo" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              BB
            </span>
            <span data-testid="nav-title"className="text-sm font-semibold tracking-tight">
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
                    ? "bg-primary-100 text-primary-600 font-semibold"
                    : "text-gray-600 hover:bg-surface-muted"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative inline-flex items-center gap-2">
                  <span>{link.label}</span>
                  {link.href === "/chatrooms" && totalBadgeCount > 0 && (
                    <span data-testid="nav-chat-badge" className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
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
                className="data-testid='nav-profile' hidden text-gray-600 underline-offset-2 hover:underline sm:inline"
            >
              {user.profile?.nickname
                ? `Hi, ${user.profile.nickname}`
                : user.email}
            </Link>
          )}
          <Button
            data-testid="logout-button"
            variant="ghost"
            size="sm"
            className="text-gray-700 hover:bg-surface-muted"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile secondary nav */}
      <div className="flex border-t border-border-subtle bg-surface px-2 py-2 text-[11px] sm:hidden">
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
                    ? "bg-primary-100 text-primary-600 font-semibold"
                    : "text-gray-600 hover:bg-surface-muted"
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
