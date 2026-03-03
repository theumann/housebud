import { z } from "zod";

export const CompatibilityAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  value: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ?? "").trim()), // string for now; can encode options/scales as needed
});

export const CompatibilityAnswersUpdateSchema = z
  .array(CompatibilityAnswerInputSchema)
  .min(1);

export type CompatibilityAnswerInput = z.infer<
  typeof CompatibilityAnswerInputSchema
>;
export type CompatibilityAnswersUpdateInput = z.infer<
  typeof CompatibilityAnswersUpdateSchema
>;
