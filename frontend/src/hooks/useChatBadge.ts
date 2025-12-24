"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useChatBadge(pollMs: number = 15000) {
  const { token } = useAuth();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const load = async () => {
      try {
        const resp = await apiFetch<any>("/chatrooms", { token });

        // Support multiple possible response shapes:
        // - { pendingInvites: [...] }
        // - { pending: [...] }
        // - { items: [...] } with status fields
        // - [...] (array)
        const invites =
            (Array.isArray(resp?.invites) && resp.invites) ||
            (Array.isArray(resp?.pendingInvites) && resp.pendingInvites) ||
            (Array.isArray(resp?.pending) && resp.pending) ||
            (Array.isArray(resp?.pendingInvites?.items) && resp.pendingInvites.items) ||
            (Array.isArray(resp?.items) && resp.items.filter((r: any) => r?.status === "pending")) ||
            (Array.isArray(resp) && resp.filter((r: any) => r?.status === "pending")) ||
            [];
        if (!cancelled) setPendingInvitesCount(invites.length);
      } catch {
        // silently ignore; badge is not critical
        if (!cancelled) setPendingInvitesCount(0);
      }
    };

    load();
    const id = window.setInterval(load, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, pollMs]);

  return { pendingInvitesCount };
}
