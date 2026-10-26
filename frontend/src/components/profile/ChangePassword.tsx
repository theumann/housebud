"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const MIN_LENGTH = 8;

export function ChangePassword() {
  const { user, token } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (next.length < MIN_LENGTH) {
      setError(`The new password needs at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/auth/password", {
        method: "POST",
        token,
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setSaving(false);
    }
  };

  const edit =
    (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      set(e.target.value);
      setError(null);
      setSuccess(false);
    };

  return (
    <Card className="mt-6" data-testid="change-password">
      <CardHeader>
        <h2 className="text-sm font-semibold">Password</h2>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              Password changed.
            </div>
          )}

          {/* Tells password managers whose password this is. */}
          <input
            type="text"
            autoComplete="username"
            value={user?.username ?? ""}
            readOnly
            hidden
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="current-password" className="block text-sm mb-1">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={edit(setCurrent)}
                className="w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm mb-1">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={edit(setNext)}
                className="w-full"
                minLength={MIN_LENGTH}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm mb-1">
                Repeat new password
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={edit(setConfirm)}
                className="w-full"
                required
              />
            </div>
          </div>
        </CardBody>

        <CardFooter className="flex items-center justify-between">
          <p className="text-xs text-subtle">
            At least {MIN_LENGTH} characters.
          </p>
          <Button
            data-testid="change-password-button"
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving || !current || !next || !confirm}
          >
            {saving ? "Saving…" : "Change password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
