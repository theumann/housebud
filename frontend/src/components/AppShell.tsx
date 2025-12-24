"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Matches", href: "/matches" },
  { label: "Shortlist", href: "/shortlist" },
  { label: "Compatibility", href: "/compatibility" },
  { label: "Chat", href: "/chatrooms" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // No nav for unauthenticated or while loading
  const showNav = !loading && !!user;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!showNav) {
    // login/signup/etc: just render the page as-is
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/matches" className="text-lg font-bold">
              Bunkbuddy
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "px-2 py-1 rounded " +
                      (active
                        ? "bg-black text-white"
                        : "text-gray-700 hover:bg-gray-100")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span className="text-gray-600 hidden sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded border border-gray-300 px-3 py-1 text-xs sm:text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
