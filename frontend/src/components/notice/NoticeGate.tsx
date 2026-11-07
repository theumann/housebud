"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TesterNotice } from "@/components/notice/TesterNotice";

// Shown over the app to someone who hasn't accepted the current tester notice:
// accounts from before it existed, and everyone after it changes. It can't be
// dismissed, only accepted, or left by logging out.
export function NoticeGate() {
  const { user, token, refreshUser, logout } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needed = user?.noticeAccepted === false;

  useEffect(() => {
    if (needed && !dialog.current?.open) dialog.current?.showModal();
  }, [needed]);

  if (!needed) return null;

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/auth/notice", { method: "POST", token });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      data-testid="notice-gate"
      aria-labelledby="notice-gate-title"
      onCancel={(e) => e.preventDefault()}
      // Browsers may close it on a second Escape anyway: it comes back.
      onClose={() => {
        if (dialog.current?.isConnected) dialog.current.showModal();
      }}
      className="m-auto max-h-[90dvh] open:flex w-[min(40rem,calc(100%-2rem))] flex-col rounded-lg border border-border-subtle bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-4 overflow-y-auto p-5">
        <h2 id="notice-gate-title" className="text-lg font-semibold">
          Before you continue
        </h2>
        <p className="text-sm text-muted">
          Please read HouseBud&apos;s tester notice: what the app stores and who
          sees it. You&apos;ll find it later under About in your account menu.
        </p>
        <TesterNotice />
      </div>
      <div className="space-y-2 border-t border-border-subtle p-4">
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => logout()}>
            Log out
          </Button>
          <Button
            data-testid="notice-accept"
            onClick={accept}
            disabled={saving}
          >
            {saving ? "Saving…" : "I agree"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
