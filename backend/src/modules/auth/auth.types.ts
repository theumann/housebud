import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().min(3).max(32),
  birthDate: z.string(), // we'll parse to Date
  school: z.string(),
  collegeYear: z.string(),
  targetCity: z.string(),
  targetState: z.string(),
  targetZip: z.string(),
  originalCity: z.string().optional(),
  originalState: z.string().optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  identifier: z.string().min(1), // email OR username
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
