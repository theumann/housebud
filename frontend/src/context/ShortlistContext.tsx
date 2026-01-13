"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ShortlistedUser = {
  userId: string;
  displayName: string;
  age: number | null;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  bio: string | null;
  avatarUrl: string | null;
};

type ShortlistContextValue = {
  shortlist: ShortlistedUser[];
  add: (user: ShortlistedUser) => void;
  remove: (userId: string) => void;
  isShortlisted: (userId: string) => boolean;
  clear: () => void;
};

const ShortlistContext = createContext<ShortlistContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "bb_shortlist";

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [shortlist, setShortlist] = useState<ShortlistedUser[]>([]);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as ShortlistedUser[];
      if (Array.isArray(data)) {
        setShortlist(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist));
    } catch {
      // ignore
    }
  }, [shortlist]);

  const add = (user: ShortlistedUser) => {
    setShortlist((prev) => {
      if (prev.some((u) => u.userId === user.userId)) return prev;
      return [...prev, user];
    });
  };

  const remove = (userId: string) => {
    setShortlist((prev) => prev.filter((u) => u.userId !== userId));
  };

  const isShortlisted = (userId: string) => {
    return shortlist.some((u) => u.userId === userId);
  };

  const clear = () => setShortlist([]);

  const value: ShortlistContextValue = {
    shortlist,
    add,
    remove,
    isShortlisted,
    clear,
  };

  return (
    <ShortlistContext.Provider value={value}>
      {children}
    </ShortlistContext.Provider>
  );
}

export function useShortlist() {
  const ctx = useContext(ShortlistContext);
  if (!ctx) {
    throw new Error("useShortlist must be used within a ShortlistProvider");
  }
  return ctx;
}
