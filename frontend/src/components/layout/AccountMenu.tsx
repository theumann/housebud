"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useMenuDismiss } from "@/hooks/useMenuDismiss";
import { Avatar } from "@/components/ui/Avatar";
import { getUserDisplayName } from "@/lib/displayName";

function SunIcon() {
  return (
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
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const itemClass =
  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground-soft hover:bg-surface-muted";

// The avatar button at the right of the nav: profile, theme and log out.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useMenuDismiss(open, close, container, button);

  if (!user) return null;

  const name = getUserDisplayName({
    username: user.username,
    profile: {
      displayName: user.profile?.displayName,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
    },
  });

  return (
    <div ref={container} className="relative">
      <button
        ref={button}
        type="button"
        data-testid="account-menu"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        <Avatar
          userId={user.id}
          name={name}
          avatarUrl={user.profile?.avatarUrl}
          size="sm"
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="account-menu-items"
          className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-border-subtle bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border-subtle px-4 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-subtle">{user.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            data-testid="nav-profile"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            data-testid="toggle-theme"
            className={itemClass}
            onClick={toggle}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
            {isDark ? "Light theme" : "Dark theme"}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="logout-button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
