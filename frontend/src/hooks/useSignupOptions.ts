"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type SignupOptions = { codeRequired: boolean; demoAvailable: boolean };

// What the backend allows: an invite code for signup, a demo sandbox.
export function useSignupOptions() {
  const [options, setOptions] = useState<SignupOptions>({
    codeRequired: false,
    demoAvailable: false,
  });

  useEffect(() => {
    apiFetch<SignupOptions>("/auth/signup-options")
      .then(setOptions)
      .catch(() => {});
  }, []);

  return options;
}
