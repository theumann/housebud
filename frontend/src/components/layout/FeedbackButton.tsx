"use client";

import { useRef, useState, FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

// Widest screenshot sent, in CSS pixels: enough to read, small as a JPEG.
const MAX_WIDTH = 1280;

// Redraws the page as it's shown right now (this tab only; the browser asks
// nothing) and keeps the part in the window.
async function captureVisiblePage() {
  const { domToCanvas } = await import("modern-screenshot");
  const scale = Math.min(window.devicePixelRatio, MAX_WIDTH / innerWidth, 2);
  const page = await domToCanvas(document.body, {
    scale,
    timeout: 5000,
    backgroundColor: document.documentElement.classList.contains("dark")
      ? "#000"
      : "#fff",
  });
  const view = document.createElement("canvas");
  view.width = Math.round(innerWidth * scale);
  view.height = Math.round(innerHeight * scale);
  view
    .getContext("2d")!
    .drawImage(
      page,
      scrollX * scale,
      scrollY * scale,
      view.width,
      view.height,
      0,
      0,
      view.width,
      view.height,
    );
  return view.toDataURL("image/jpeg", 0.8);
}

function BugIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M9 6a3 3 0 0 1 6 0M12 11v9M3 13h5M16 13h5M4 7l4 2M20 7l-4 2M4 20l4-2M20 20l-4-2" />
    </svg>
  );
}

// "Report a problem": a description and, unless unticked, a screenshot of the
// page, with the page address and screen size. Read with `npm run feedback`.
export function FeedbackButton() {
  const { user, token } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [page, setPage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!user) return null;

  const open = async () => {
    setCapturing(true);
    setPage(location.pathname + location.search);
    setMessage("");
    setError(null);
    setSent(false);
    // Taken before the dialog opens, so it shows the page and not the form.
    let shot: string | null = null;
    try {
      shot = await captureVisiblePage();
    } catch {
      // Sent without one; the dialog says so.
    }
    setScreenshot(shot);
    setIncludeScreenshot(shot !== null);
    setCapturing(false);
    dialog.current?.showModal();
  };

  const close = () => dialog.current?.close();

  const attach = includeScreenshot && screenshot !== null;
  const canSend = !sending && (message.trim() !== "" || attach);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch("/feedback", {
        method: "POST",
        token,
        body: {
          message,
          page,
          viewport: `${innerWidth}x${innerHeight}`,
          ...(attach ? { screenshot } : {}),
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send it");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="feedback-button"
        aria-label="Report a problem"
        title="Report a problem"
        disabled={capturing}
        aria-busy={capturing}
        onClick={open}
        className="rounded-full p-1.5 text-foreground-soft hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
      >
        <BugIcon />
      </button>

      <dialog
        ref={dialog}
        data-testid="feedback-dialog"
        aria-labelledby="feedback-title"
        onClose={() => setScreenshot(null)}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border-subtle bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {sent ? (
          <div className="space-y-4 p-5">
            <h2 id="feedback-title" className="text-base font-semibold">
              Thanks!
            </h2>
            <p data-testid="feedback-sent" className="text-sm text-muted">
              Your report was sent.
            </p>
            <div className="flex justify-end">
              <Button onClick={close}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4 p-5">
            <h2 id="feedback-title" className="text-base font-semibold">
              Report a problem
            </h2>

            <div>
              <label htmlFor="feedback-message" className="mb-1 block text-sm">
                What happened?
              </label>
              <Textarea
                id="feedback-message"
                data-testid="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full resize-y"
                placeholder="What you did, what you expected, what you saw instead."
              />
            </div>

            {screenshot ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid="feedback-include-screenshot"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                  />
                  Include screenshot
                </label>
                {includeScreenshot && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot}
                      alt="The screenshot that will be sent"
                      data-testid="feedback-screenshot-preview"
                      className="max-h-48 w-full rounded border border-border-subtle object-contain object-top"
                    />
                    <p className="text-xs text-subtle">
                      It shows this page as you see it, including anything
                      housemates wrote on it. It does not show anything outside
                      of the app itself.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-subtle">
                A screenshot couldn&apos;t be taken on this page. Please
                describe what you see.
              </p>
            )}

            <p className="text-xs text-subtle">
              The page address, your browser and screen size are sent too.
            </p>

            {error && (
              <p
                role="alert"
                data-testid="feedback-error"
                className="text-sm text-red-700 dark:text-red-400"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="feedback-send"
                disabled={!canSend}
              >
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
