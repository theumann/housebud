"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// "/" is the app's landing logic; login and the nav logo send people here.
// Members of a household land on it; everyone else lands on Matches.
async function landingPath(token: string) {
  try {
    const households = await apiFetch<{ id: string }[]>("/households", {
      token,
    });
    return households.length > 0
      ? `/household/${households[0].id}`
      : "/matches";
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

  return (
    <main
      role="status"
      className="flex min-h-screen items-center justify-center"
    >
      <Image
        src="/logo-mark.svg"
        alt=""
        width={72}
        height={72}
        unoptimized
        priority
        className="animate-pulse"
      />
      <span className="sr-only">Loading HouseBud…</span>
    </main>
  );
}
