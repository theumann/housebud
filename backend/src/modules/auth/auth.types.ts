import { z } from "zod";

// Bump when the tester notice (frontend/src/components/notice/TesterNotice.tsx)
// changes what it says: everyone is asked to accept it again on their next visit.
export const NOTICE_VERSION = 1;

// Signup refuses anyone younger. 16- and 17-year-olds may be let in later.
export const MIN_SIGNUP_AGE = 18;

export const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v === "" ? null : v)),
  // "YYYY-MM-DD", which the minimum age is checked against.
  birthDate: z.iso.date(),
  school: z.string(),
  collegeYear: z.string(),
  targetCity: z.string(),
  targetState: z.string(),
  targetZip: z.string(),
  originalCity: z.string().optional(),
  originalState: z.string().optional(),
  signupCode: z.string().optional(),
  acceptNotice: z.literal(true, {
    error: "Please read and accept the tester notice",
  }),
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(1), // email OR username
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
