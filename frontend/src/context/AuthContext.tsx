"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type UserProfile = {
  id: string;
  email: string;
  profile: {
    nickname: string;
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
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type SignupPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from localStorage on first mount
  useEffect(() => {
    const storedToken =
      typeof window !== "undefined" ? localStorage.getItem("bb_token") : null;
    if (storedToken) {
      setToken(storedToken);
      // fetch user profile in background
      apiFetch<UserProfile>("/profile/me", { token: storedToken })
        .then((u) => setUser(u))
        .catch(() => {
          // token invalid; clear it
          localStorage.removeItem("bb_token");
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{
      token: string;
      user: UserProfile;
    }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setToken(res.token);
    setUser(res.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("bb_token", res.token);
    }
  };

  const signup = async (payload: SignupPayload) => {
    const res = await apiFetch<{
      token: string;
      user: UserProfile;
    }>("/auth/signup", {
      method: "POST",
      body: payload,
    });

    setToken(res.token);
    setUser(res.user);
    if (typeof window !== "undefined") {
      localStorage.setItem("bb_token", res.token);
    }
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
    logout,
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
