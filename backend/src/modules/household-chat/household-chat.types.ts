import { z } from "zod";

export const GetHouseholdMessagesQuerySchema = z.object({
  after: z.coerce.date().optional(),
});
export type GetHouseholdMessagesQuery = z.infer<
  typeof GetHouseholdMessagesQuerySchema
>;

export const SendHouseholdMessageSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});
export type SendHouseholdMessageInput = z.infer<
  typeof SendHouseholdMessageSchema
>;
