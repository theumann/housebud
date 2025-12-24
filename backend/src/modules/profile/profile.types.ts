import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nickname: z.string().optional(),
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
