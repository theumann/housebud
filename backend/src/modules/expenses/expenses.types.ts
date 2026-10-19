import { z } from "zod";

// A calendar date ("2026-10-06") with no time zone, stored as UTC midnight.
const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

// Whole cents, up to 1,000,000.00.
const AmountCentsSchema = z.number().int().min(1).max(100_000_000);

const ExpenseFieldsSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amountCents: AmountCentsSchema,
  paidByUserId: z.string().min(1),
  spentOn: DateOnlySchema,
  // Split equally between these members.
  splitWith: z
    .array(z.string().min(1))
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate member"),
});

export const CreateExpenseSchema = ExpenseFieldsSchema.extend({
  // Checked shopping list items bought with this expense.
  shoppingItemIds: z.array(z.string().min(1)).max(100).default([]),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const UpdateExpenseSchema = ExpenseFieldsSchema.partial();
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

const SettlementFieldsSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amountCents: AmountCentsSchema,
  paidOn: DateOnlySchema,
});

export const CreateSettlementSchema = SettlementFieldsSchema.refine(
  (s) => s.fromUserId !== s.toUserId,
  { message: "Payer and recipient must be different", path: ["toUserId"] },
);
export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;

export const UpdateSettlementSchema = SettlementFieldsSchema.partial();
export type UpdateSettlementInput = z.infer<typeof UpdateSettlementSchema>;
