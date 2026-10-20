import { z } from "zod";

const Title = z.string().trim().min(1).max(120);
const Details = z.string().trim().max(1000).optional();
const Reason = z.string().trim().max(500).optional();

export const ProposeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add"),
    title: Title,
    details: Details,
    reason: Reason,
  }),
  z.object({
    kind: z.literal("change"),
    ruleId: z.string().min(1),
    title: Title,
    details: Details,
    reason: Reason,
  }),
  z.object({
    kind: z.literal("remove"),
    ruleId: z.string().min(1),
    reason: Reason,
  }),
]);
export type ProposeInput = z.infer<typeof ProposeSchema>;

export const VoteSchema = z.object({
  agree: z.boolean(),
  // Why not; only kept for a "no".
  reason: Reason,
});
export type VoteInput = z.infer<typeof VoteSchema>;
