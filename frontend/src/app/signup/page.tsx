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
    <main
      data-testid="signup-page"
      className="min-h-screen flex items-center justify-center"
    >
      <div className="w-full max-w-lg border rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Sign up</h1>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col-reverse">
            <input
              id="signup-email"
              name="email"
              type="email"
              className="peer w-full border rounded px-3 py-2"
              value={form.email}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-email"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Email
            </label>
          </div>
          <div className="col-span-2 flex flex-col-reverse">
            <input
              id="signup-password"
              name="password"
              type="password"
              className="peer w-full border rounded px-3 py-2"
              value={form.password}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-password"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Password
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-first-name"
              name="firstName"
              className="peer w-full border rounded px-3 py-2"
              value={form.firstName}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-first-name"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              First name
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-last-name"
              name="lastName"
              className="peer w-full border rounded px-3 py-2"
              value={form.lastName}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-last-name"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Last name
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-username"
              name="username"
              className="peer w-full border rounded px-3 py-2"
              value={form.username}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-username"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Username
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-display-name"
              name="displayName"
              className="peer w-full border rounded px-3 py-2"
              value={form.displayName}
              placeholder="How others see you."
              onChange={onChange}
            />
            <label
              htmlFor="signup-display-name"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Display Name
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-birth-date"
              name="birthDate"
              type="date"
              className={`peer w-full border rounded px-3 py-2 ${
                form.birthDate ? "text-black" : "text-gray-400"
              }`}
              value={form.birthDate}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-birth-date"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Birth date
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-school"
              name="school"
              className="peer w-full border rounded px-3 py-2"
              value={form.school}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-school"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              School
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <select
              id="signup-college-year"
              name="collegeYear"
              className={`peer w-full border rounded px-3 py-2 bg-white ${
                form.collegeYear ? "text-black" : "text-gray-400"
              }`}
              value={form.collegeYear}
              onChange={(e) =>
                setForm((f) => ({ ...f, collegeYear: e.target.value }))
              }
              required
            >
              <option value="">Select year</option>
              <option value="Freshman">Freshman</option>
              <option value="Sophomore">Sophomore</option>
              <option value="Junior">Junior</option>
              <option value="Senior">Senior</option>
            </select>
            <label
              htmlFor="signup-college-year"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              College year
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-target-city"
              name="targetCity"
              className="peer w-full border rounded px-3 py-2"
              value={form.targetCity}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-target-city"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Target city
            </label>
          </div>
          <div className="flex flex-col-reverse">
            <input
              id="signup-target-state"
              name="targetState"
              className="peer w-full border rounded px-3 py-2"
              value={form.targetState}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-target-state"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Target state
            </label>
          </div>
          <div className="col-span-2 flex flex-col-reverse">
            <input
              id="signup-target-zip"
              name="targetZip"
              className="peer w-full border rounded px-3 py-2"
              value={form.targetZip}
              onChange={onChange}
              required
            />
            <label
              htmlFor="signup-target-zip"
              className="block text-sm mb-1 peer-required:after:content-['*'] peer-required:after:text-red-600"
            >
              Target ZIP
            </label>
          </div>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="col-span-2 bg-black text-white rounded py-2"
            disabled={submitting}
          >
            {submitting ? "Signing up..." : "Sign up"}
          </button>
          <p className="col-span-2 text-xs text-red-600">*: required fields</p>
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
