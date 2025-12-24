import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string(),
  nickname: z.string(),
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
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
