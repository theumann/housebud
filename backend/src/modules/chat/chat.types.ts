import { z } from "zod";

export const CreateChatRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  participantIds: z.array(z.string().uuid()).min(1), // at least one other user
});

export type CreateChatRoomInput = z.infer<typeof CreateChatRoomSchema>;

export const InviteToChatSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1),
});

export type InviteToChatInput = z.infer<typeof InviteToChatSchema>;

export const UpdateChatRoomSchema = z.object({
  name: z.string().min(1).max(100),
});

export type UpdateChatRoomInput = z.infer<typeof UpdateChatRoomSchema>;


export const KickParticipantSchema = z.object({
  userId: z.string().uuid(),
});

export type KickParticipantInput = z.infer<typeof KickParticipantSchema>;

export const SendMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;