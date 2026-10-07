import { z } from "zod";

// A calendar date ("2026-10-06") with no time zone, stored as UTC midnight.
const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

export const REPEAT_UNITS = ["day", "week", "month", "quarter"] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

export const RepeatSchema = z.object({
  every: z.number().int().min(1).max(365),
  unit: z.enum(REPEAT_UNITS),
});
export type Repeat = z.infer<typeof RepeatSchema>;

const ChoreFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // null: done once, no repeat.
  repeat: RepeatSchema.nullable(),
  dueDate: DateOnlySchema,
  // Turn order; the first user is up next.
  rotation: z.array(z.string().min(1)).max(20),
});

export const CreateChoreSchema = ChoreFieldsSchema.extend({
  rotation: ChoreFieldsSchema.shape.rotation.default([]),
});
export type CreateChoreInput = z.infer<typeof CreateChoreSchema>;

export const UpdateChoreSchema = ChoreFieldsSchema.partial();
export type UpdateChoreInput = z.infer<typeof UpdateChoreSchema>;

export const CompleteChoreSchema = z.object({
  // The day it was done in the user's own time zone, so "done today" means
  // their today, not the server's.
  completedOn: DateOnlySchema,
});
export type CompleteChoreInput = z.infer<typeof CompleteChoreSchema>;
