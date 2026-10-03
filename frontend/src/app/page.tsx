"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// "/" is the app's landing logic; login and the nav logo send people here.
// Members of a household land on it; everyone else lands on Matches.
async function landingPath(token: string) {
  try {
    const households = await apiFetch<unknown[]>("/households", { token });
    return households.length > 0 ? "/household" : "/matches";
  } catch {
    return "/matches";
  }
}

export default function Home() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    landingPath(token).then((path) => {
      if (!cancelled) router.replace(path);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, token, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Redirecting...</p>
    </main>
  );
}
