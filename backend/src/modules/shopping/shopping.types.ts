import { z } from "zod";

export const CreateShoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.string().trim().max(30).optional(),
});
export type CreateShoppingItemInput = z.infer<typeof CreateShoppingItemSchema>;

export const UpdateShoppingItemSchema = z.object({
  checked: z.boolean(),
});
export type UpdateShoppingItemInput = z.infer<typeof UpdateShoppingItemSchema>;
