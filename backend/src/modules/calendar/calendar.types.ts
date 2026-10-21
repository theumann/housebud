import { z } from "zod";
import { RepeatSchema } from "../chores/chores.types";

// A calendar date ("2026-10-06") with no time zone, stored as UTC midnight.
const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

// The house's clock time, no time zone.
const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 19:30");

const Notes = z.string().trim().max(500).optional();

// The longest away/guest entry or multi-day event.
export const MAX_SPAN_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const spanDays = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

const dayRange = {
  startsOn: DateOnlySchema,
  endsOn: DateOnlySchema.optional(),
};

export const EventInputSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("event"),
      title: z.string().trim().min(1).max(80),
      notes: Notes,
      ...dayRange,
      startTime: TimeSchema.optional(),
      endTime: TimeSchema.optional(),
      repeat: RepeatSchema.nullable().default(null),
    }),
    z.object({
      kind: z.literal("away"),
      // Defaults to whoever adds it; only the owner can add one for someone
      // else.
      userId: z.string().min(1).optional(),
      notes: Notes,
      ...dayRange,
    }),
    z.object({
      kind: z.literal("guest"),
      userId: z.string().min(1).optional(),
      // The guest, e.g. "My sister".
      title: z.string().trim().max(80).optional(),
      notes: Notes,
      ...dayRange,
    }),
  ])
  .transform((e) => ({ ...e, endsOn: e.endsOn ?? e.startsOn }))
  .superRefine((e, ctx) => {
    const span = spanDays(e.startsOn, e.endsOn);
    if (span < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "The end can't be before the start",
      });
    } else if (span > MAX_SPAN_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "That's longer than a year",
      });
    }
    if (e.kind !== "event") return;
    if (e.endTime && !e.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "An end time needs a start time",
      });
    }
    if (e.startTime && e.endTime && e.endTime <= e.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "The end time must be after the start time",
      });
    }
    if (e.startTime && span > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "An event with a time is on one day",
      });
    }
    if (e.repeat && span > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["repeat"],
        message: "Only one-day events can repeat",
      });
    }
  });
export type EventInput = z.infer<typeof EventInputSchema>;

// Longest range one request can ask for: a month grid is at most 6 weeks.
export const MAX_RANGE_DAYS = 62;

export const RangeSchema = z
  .object({
    from: DateOnlySchema,
    to: DateOnlySchema,
    // The viewer's today, so overdue chores land on their today.
    today: DateOnlySchema.optional(),
  })
  .refine((r) => r.to >= r.from, {
    message: "The end can't be before the start",
    path: ["to"],
  })
  .refine((r) => spanDays(r.from, r.to) < MAX_RANGE_DAYS, {
    message: `Ask for at most ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });
export type RangeInput = z.infer<typeof RangeSchema>;

export const SkipSchema = z.object({ date: DateOnlySchema });
export type SkipInput = z.infer<typeof SkipSchema>;
