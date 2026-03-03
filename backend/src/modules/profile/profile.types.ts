import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First Name is required")
    .max(50)
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(1, "Last Name is required")
    .max(50)
    .optional(),
  displayName: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v === "" ? null : v)),
  birthDate: z.string().optional(), // ISO date string
  school: z.string().optional(),
  collegeYear: z.string().optional(),
  originalCity: z.string().optional().nullable(),
  originalState: z.string().optional().nullable(),
  targetCity: z.string().optional(),
  targetState: z.string().optional(),
  targetZip: z.string().optional(),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
