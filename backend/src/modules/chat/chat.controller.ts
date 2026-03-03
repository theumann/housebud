import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authMiddleware";
import type { PrismaClient } from "@prisma/client";
import {
  CreateChatRoomSchema,
  InviteToChatSchema,
  KickParticipantSchema,
  SendMessageSchema,
  UpdateChatRoomSchema,
} from "./chat.types";
import {
  listChatRoomsForUser,
  createChatRoom,
  inviteToChatRoom,
  respondToInvite,
  leaveChatRoom,
  kickParticipant,
  getMessages,
  sendMessage,
  getChatRoomDetailsForUser,
  renameChatRoom,
} from "./chat.service";

export async function listChatRoomsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await listChatRoomsForUser(prisma, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createChatRoomHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const input = CreateChatRoomSchema.parse(req.body);
    const result = await createChatRoom(prisma, req.userId, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteToChatRoomHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const input = InviteToChatSchema.parse(req.body);

    await inviteToChatRoom(prisma, req.userId, roomId, input);
    res.json({ message: "Invites sent" });
  } catch (err) {
    next(err);
  }
}

export async function acceptInviteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    await respondToInvite(prisma, req.userId, roomId, true);
    res.json({ message: "Invite accepted" });
  } catch (err) {
    next(err);
  }
}

export async function declineInviteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    await respondToInvite(prisma, req.userId, roomId, false);
    res.json({ message: "Invite declined" });
  } catch (err) {
    next(err);
  }
}

export async function getChatRoomDetailsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const details = await getChatRoomDetailsForUser(prisma, req.userId, roomId);
    res.json(details);
  } catch (err) {
    next(err);
  }
}

export async function renameChatRoomHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const input = UpdateChatRoomSchema.parse(req.body);

    await renameChatRoom(prisma, req.userId, roomId, input);
    res.json({ message: "Room renamed" });
  } catch (err) {
    next(err);
  }
}

export async function leaveChatRoomHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    await leaveChatRoom(prisma, req.userId, roomId);
    res.json({ message: "Left chat room" });
  } catch (err) {
    next(err);
  }
}

export async function kickParticipantHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const { userId } = KickParticipantSchema.parse(req.body);

    await kickParticipant(prisma, req.userId, roomId, userId);
    res.json({ message: "Participant removed" });
  } catch (err) {
    next(err);
  }
}

export async function getMessagesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const afterParam = req.query.after as string | undefined;
    const after = afterParam ? new Date(afterParam) : undefined;

    const messages = await getMessages(prisma, req.userId, roomId, after);
    res.json(messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessageHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

    const roomId = req.params.roomId;
    const input = SendMessageSchema.parse(req.body);

    const message = await sendMessage(prisma, req.userId, roomId, input);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}
