"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

type UserProfile = {
  id: string;
  email: string;
  username: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarUrl?: string | null;
    school: string;
    collegeYear: string;
    targetCity: string;
    targetState: string;
    targetZip: string;
  } | null;
};

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  // Staging only: a throwaway account in a sample household.
  startDemo: () => Promise<void>;
  logout: () => void;
  // Re-fetch the user after their profile changed (name, photo).
  refreshUser: () => Promise<void>;
};

type AuthResponse = { token: string; user: UserProfile };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SignupPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  username: string;
  birthDate: string;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  signupCode?: string;
};

// Tries over about 3 seconds before giving up on loading the profile.
const PROFILE_ATTEMPTS = 3;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from localStorage on first mount
  useEffect(() => {
    const storedToken =
      typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;
    if (!storedToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    // localStorage only exists after mount; reading it during render would
    // make the server and client renders disagree.
    setToken(storedToken);

    // Only a 401 means the token is invalid. Any other failure (a dropped or
    // cancelled request, a server error) keeps the token and is retried, with
    // `loading` still true so pages wait instead of sending the user to /login.
    let cancelled = false;
    const loadUser = async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          const u = await apiFetch<UserProfile>("/profile/me", {
            token: storedToken,
          });
          if (!cancelled) setUser(u);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            localStorage.removeItem("bb_token");
            if (!cancelled) {
              setToken(null);
              setUser(null);
            }
            break;
          }
          if (attempt === PROFILE_ATTEMPTS) break;
          await new Promise((r) => setTimeout(r, attempt * 1000));
          if (cancelled) return;
        }
      }
      if (!cancelled) setLoading(false);
    };
    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const storeSession = (res: AuthResponse) => {
    setToken(res.token);
    setUser(res.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("bb_token", res.token);
    }
  };

  const login = async (identifier: string, password: string) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { identifier, password },
    });

    storeSession(res);
  };

  const signup = async (payload: SignupPayload) => {
    const res = await apiFetch<AuthResponse>("/auth/signup", {
      method: "POST",
      body: payload,
    });

    storeSession(res);
  };

  const startDemo = async () => {
    storeSession(
      await apiFetch<AuthResponse>("/demo/sandbox", { method: "POST" }),
    );
  };

  const refreshUser = async () => {
    if (!token) return;
    setUser(await apiFetch<UserProfile>("/profile/me", { token }));
  };

  const logout = async () => {
    try {
      if (token) {
        await apiFetch<{ message: string }>("/auth/logout", {
          method: "POST",
          token,
        });
      }
    } catch {
      // ignore errors on logout
    }
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("bb_token");
    }
  };

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    signup,
    startDemo,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
