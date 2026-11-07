"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import clsx from "clsx";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ApiError } from "@/lib/api";
import { matchingEnabled } from "@/lib/features";
import { useSignupOptions } from "@/hooks/useSignupOptions";
import { TesterNotice } from "@/components/notice/TesterNotice";

type SignupField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  // Only asked while matching is on; households don't need it.
  matchingOnly?: boolean;
};

const FIELDS: SignupField[] = [
  {
    name: "email",
    label: "Email",
    wide: true,
    type: "email",
    required: true,
    autoComplete: "email",
  },
  {
    name: "password",
    label: "Password",
    wide: true,
    type: "password",
    required: true,
    autoComplete: "new-password",
  },
  {
    name: "firstName",
    label: "First name",
    required: true,
    autoComplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    required: true,
    autoComplete: "family-name",
  },
  {
    name: "username",
    label: "Username",
    required: true,
    autoComplete: "username",
  },
  {
    name: "displayName",
    label: "Display name",
    placeholder: "How others see you",
  },
  {
    name: "birthDate",
    label: "Birth date",
    type: "date",
    required: true,
    autoComplete: "bday",
    hint: "You must be 18 or older.",
  },
  {
    name: "collegeYear",
    label: "College year",
    required: true,
    matchingOnly: true,
  },
  {
    name: "school",
    label: "School",
    wide: true,
    required: true,
    matchingOnly: true,
  },
  {
    name: "targetCity",
    label: "Target city",
    wide: true,
    required: true,
    matchingOnly: true,
  },
  {
    name: "targetState",
    label: "Target state",
    required: true,
    matchingOnly: true,
  },
  {
    name: "targetZip",
    label: "Target ZIP",
    required: true,
    matchingOnly: true,
  },
];

const SHOWN_FIELDS = FIELDS.filter((f) => matchingEnabled || !f.matchingOnly);

const COLLEGE_YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  // A shared link like /signup?code=… fills in the invite code.
  const codeFromLink = useSearchParams().get("code") ?? "";
  const { codeRequired, demoAvailable } = useSignupOptions();
  // A 403 means a code is needed even if the options didn't say so.
  const [codeRefused, setCodeRefused] = useState(false);
  const [form, setForm] = useState({
    signupCode: codeFromLink,
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    username: "",
    displayName: "",
    birthDate: "",
    school: "",
    collegeYear: "",
    targetCity: "",
    targetState: "",
    targetZip: "",
  });
  const [acceptNotice, setAcceptNotice] = useState(false);
  const notice = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showCodeField = codeRequired || codeRefused || Boolean(codeFromLink);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Fields that aren't shown aren't sent.
      const shown = Object.fromEntries(
        Object.entries(form).filter(
          ([name]) =>
            name === "signupCode" || SHOWN_FIELDS.some((f) => f.name === name),
        ),
      ) as typeof form;
      await signup({ ...shown, acceptNotice });
      // A new user has no household yet.
      router.replace(matchingEnabled ? "/matches" : "/household");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      if (err instanceof ApiError && err.status === 403) setCodeRefused(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      data-testid="signup-page"
      title="Create your account"
      subtitle="Find roommates, then run the household together."
      wide
    >
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {showCodeField && (
          <div className="sm:col-span-2">
            <label
              htmlFor="signup-code"
              className="mb-1 block text-sm font-medium"
            >
              Invite code
              <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <Input
              id="signup-code"
              data-testid="signup-code"
              name="signupCode"
              value={form.signupCode}
              onChange={onChange}
              required
              autoComplete="off"
              className="w-full"
            />
            <p className="mt-1 text-xs text-subtle">
              HouseBud is invite-only for now. Ask the person who invited you.
            </p>
          </div>
        )}
        {SHOWN_FIELDS.map((field) => {
          const id = `signup-${field.name}`;
          const value = form[field.name as keyof typeof form];
          return (
            <div
              key={field.name}
              className={clsx(field.wide && "sm:col-span-2")}
            >
              <label htmlFor={id} className="mb-1 block text-sm font-medium">
                {field.label}
                {field.required && (
                  <span className="text-red-600 dark:text-red-400">*</span>
                )}
              </label>
              {field.name === "collegeYear" ? (
                <Select
                  id={id}
                  name={field.name}
                  value={value}
                  onChange={onChange}
                  required
                  className={clsx("w-full", !value && "text-faint")}
                >
                  <option value="">Select year</option>
                  {COLLEGE_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  name={field.name}
                  type={field.type ?? "text"}
                  value={value}
                  onChange={onChange}
                  required={field.required}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  className={clsx(
                    "w-full",
                    field.type === "date" && !value && "text-faint",
                  )}
                />
              )}
              {field.hint && (
                <p className="mt-1 text-xs text-subtle">{field.hint}</p>
              )}
            </div>
          );
        })}
        <div className="space-y-1 sm:col-span-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="signup-accept-notice"
              checked={acceptNotice}
              onChange={(e) => setAcceptNotice(e.target.checked)}
              required
              className="mt-0.5"
            />
            <span>
              I&apos;ve read and accept the tester notice: what HouseBud stores
              and who sees it.
              <span className="text-red-600 dark:text-red-400">*</span>
            </span>
          </label>
          <button
            type="button"
            data-testid="signup-notice-link"
            onClick={() => notice.current?.showModal()}
            className="ml-6 text-sm font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400"
          >
            Read the tester notice
          </button>
        </div>
        {error && (
          <p
            role="alert"
            data-testid="signup-error"
            className="text-sm text-red-600 sm:col-span-2 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full sm:col-span-2"
          disabled={submitting}
        >
          {submitting ? "Signing up..." : "Sign up"}
        </Button>
        <p className="text-xs text-muted sm:col-span-2">
          <span className="text-red-600 dark:text-red-400">*</span> Required
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400"
        >
          Log in
        </Link>
      </p>
      <dialog
        ref={notice}
        data-testid="signup-notice-dialog"
        aria-labelledby="signup-notice-title"
        className="m-auto max-h-[90dvh] open:flex w-[min(40rem,calc(100%-2rem))] flex-col rounded-lg border border-border-subtle bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 overflow-y-auto p-5">
          <h2 id="signup-notice-title" className="text-lg font-semibold">
            Tester notice
          </h2>
          <TesterNotice />
        </div>
        <div className="flex justify-end gap-2 border-t border-border-subtle p-4">
          <Button variant="secondary" onClick={() => notice.current?.close()}>
            Close
          </Button>
          <Button
            data-testid="signup-notice-accept"
            onClick={() => {
              setAcceptNotice(true);
              notice.current?.close();
            }}
          >
            I accept
          </Button>
        </div>
      </dialog>
      <p className="mt-2 text-center text-sm text-muted">
        <Link
          href="/about"
          className="font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400"
        >
          About HouseBud
        </Link>
      </p>
      {demoAvailable && (
        <p className="mt-2 text-center text-sm text-muted">
          Just looking around?{" "}
          <Link
            href="/demo"
            data-testid="try-demo-link"
            className="font-medium text-primary-700 underline underline-offset-2 dark:text-primary-400"
          >
            Try the demo
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
