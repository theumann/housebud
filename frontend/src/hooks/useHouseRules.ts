"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useHouseholdInvites } from "@/context/HouseholdInvitesContext";
import { ApiError, apiFetch } from "@/lib/api";

export type RuleUser = {
  id: string;
  username: string;
  profile: {
    displayName: string | null;
    firstName: string;
    lastName: string;
  } | null;
};

export type HouseRule = {
  id: string;
  title: string;
  details: string | null;
  adoptedAt: string;
};

export type ProposalKind = "add" | "change" | "remove";

export type RuleProposal = {
  id: string;
  kind: ProposalKind;
  title: string;
  details: string | null;
  reason: string | null;
  // The rule as it is now, for a change or removal.
  rule: { id: string; title: string; details: string | null } | null;
  proposedBy: RuleUser | null;
  createdAt: string;
  agreed: RuleUser[];
  waitingOn: RuleUser[];
  myAnswer: boolean;
  canWithdraw: boolean;
};

export type DecidedProposal = {
  id: string;
  kind: ProposalKind;
  title: string;
  details: string | null;
  status: "adopted" | "declined" | "withdrawn";
  decidedAt: string;
  proposedBy: RuleUser | null;
  declinedBy: { user: RuleUser; reason: string | null } | null;
};

type Overview = {
  rules: HouseRule[];
  proposals: RuleProposal[];
  history: DecidedProposal[];
  needsMyAgreement: boolean;
  notAgreed: RuleUser[];
};

export type ProposalInput =
  | { kind: "add"; title: string; details?: string; reason?: string }
  | {
      kind: "change";
      ruleId: string;
      title: string;
      details?: string;
      reason?: string;
    }
  | { kind: "remove"; ruleId: string; reason?: string };

export function useHouseRules(householdId: string, pollMs = 15_000) {
  const { token } = useAuth();
  // The nav badge counts proposals waiting for me; refresh it after answering.
  const { refresh: refreshBadges } = useHouseholdInvites();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 404: the module was turned off (or we lost access) since the page loaded.
  const [unavailable, setUnavailable] = useState(false);
  // Only the latest request may update the data, so a slow poll can't undo a
  // change made after it started.
  const requestSeq = useRef(0);
  const base = `/households/${householdId}/rules`;

  const refresh = useCallback(async () => {
    if (!token) return;
    const seq = ++requestSeq.current;
    try {
      const data = await apiFetch<Overview>(base, { token });
      if (seq !== requestSeq.current) return;
      setOverview(data);
      setError(null);
      setUnavailable(false);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setUnavailable(true);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load house rules",
        );
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, base]);

  useEffect(() => {
    if (!token) return;
    const seqRef = requestSeq;
    const first = window.setTimeout(refresh, 0);
    const id = window.setInterval(refresh, pollMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      seqRef.current++;
    };
  }, [token, pollMs, refresh]);

  const send = async (path: string, body?: unknown) => {
    requestSeq.current++;
    try {
      await apiFetch(`${base}${path}`, { method: "POST", token, body });
    } finally {
      await Promise.all([refresh(), refreshBadges()]);
    }
  };

  return {
    rules: overview?.rules ?? [],
    proposals: overview?.proposals ?? [],
    history: overview?.history ?? [],
    needsMyAgreement: overview?.needsMyAgreement ?? false,
    notAgreed: overview?.notAgreed ?? [],
    loading,
    error,
    unavailable,
    propose: (input: ProposalInput) => send("/proposals", input),
    answer: (proposalId: string, agree: boolean, reason?: string) =>
      send(`/proposals/${proposalId}/vote`, { agree, reason }),
    withdraw: (proposalId: string) => send(`/proposals/${proposalId}/withdraw`),
    agreeToRules: () => send("/agree"),
  };
}
