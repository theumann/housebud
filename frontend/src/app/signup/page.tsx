"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import clsx from "clsx";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

type SignupField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
  autoComplete?: string;
  placeholder?: string;
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
  },
  { name: "collegeYear", label: "College year", required: true },
  { name: "school", label: "School", wide: true, required: true },
  { name: "targetCity", label: "Target city", wide: true, required: true },
  { name: "targetState", label: "Target state", required: true },
  { name: "targetZip", label: "Target ZIP", required: true },
];

const COLLEGE_YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      await signup(form);
      router.replace("/matches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
        {FIELDS.map((field) => {
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
            </div>
          );
        })}
        {error && (
          <p
            role="alert"
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
          className="font-medium text-primary-700 underline underline-offset-2 dark:text-primary-500"
        >
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
