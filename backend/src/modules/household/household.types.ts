import { z } from "zod";

export const CreateHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateHouseholdInput = z.infer<typeof CreateHouseholdSchema>;

export const UpdateHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type UpdateHouseholdInput = z.infer<typeof UpdateHouseholdSchema>;

export const UpdateSettingsSchema = z
  .object({
    choresEnabled: z.boolean(),
    shoppingEnabled: z.boolean(),
    expensesEnabled: z.boolean(),
    calendarEnabled: z.boolean(),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type InviteInput = z.infer<typeof InviteSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

export const JoinByCodeSchema = z.object({
  joinCode: z.string().trim().toUpperCase().min(4).max(12),
});
export type JoinByCodeInput = z.infer<typeof JoinByCodeSchema>;

export const HOUSEHOLD_MODULES = [
  "chores",
  "shopping",
  "expenses",
  "calendar",
] as const;
export type HouseholdModule = (typeof HOUSEHOLD_MODULES)[number];

export const MODULE_SETTING_KEY: Record<
  HouseholdModule,
  "choresEnabled" | "shoppingEnabled" | "expensesEnabled" | "calendarEnabled"
> = {
  chores: "choresEnabled",
  shopping: "shoppingEnabled",
  expenses: "expensesEnabled",
  calendar: "calendarEnabled",
};
