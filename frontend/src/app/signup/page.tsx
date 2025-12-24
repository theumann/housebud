"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    nickname: "",
    birthDate: "",
    school: "",
    collegeYear: "",
    targetCity: "",
    targetState: "",
    targetZip: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form);
      router.replace("/matches");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main data-testid="signup-page" className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg border rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Sign up</h1>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm mb-1">Email</label>
            <input
              name="email"
              type="email"
              className="w-full border rounded px-3 py-2"
              value={form.email}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm mb-1">Password</label>
            <input
              name="password"
              type="password"
              className="w-full border rounded px-3 py-2"
              value={form.password}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">First name</label>
            <input
              name="firstName"
              className="w-full border rounded px-3 py-2"
              value={form.firstName}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Last name</label>
            <input
              name="lastName"
              className="w-full border rounded px-3 py-2"
              value={form.lastName}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Nickname</label>
            <input
              name="nickname"
              className="w-full border rounded px-3 py-2"
              value={form.nickname}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Birth date</label>
            <input
              name="birthDate"
              type="date"
              className="w-full border rounded px-3 py-2"
              value={form.birthDate}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">School</label>
            <input
              name="school"
              className="w-full border rounded px-3 py-2"
              value={form.school}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">College year</label>
            <input
              name="collegeYear"
              className="w-full border rounded px-3 py-2"
              value={form.collegeYear}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Target city</label>
            <input
              name="targetCity"
              className="w-full border rounded px-3 py-2"
              value={form.targetCity}
              onChange={onChange}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Target state</label>
            <input
              name="targetState"
              className="w-full border rounded px-3 py-2"
              value={form.targetState}
              onChange={onChange}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm mb-1">Target ZIP</label>
            <input
              name="targetZip"
              className="w-full border rounded px-3 py-2"
              value={form.targetZip}
              onChange={onChange}
              required
            />
          </div>
          {error && (
            <p className="col-span-2 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            className="col-span-2 bg-black text-white rounded py-2"
            disabled={submitting}
          >
            {submitting ? "Signing up..." : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 underline">
            Login
          </a>
        </p>
      </div>
    </main>
  );
}
