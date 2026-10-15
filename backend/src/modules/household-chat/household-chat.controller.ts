import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./household-chat.service";
import {
  GetHouseholdMessagesQuerySchema,
  SendHouseholdMessageSchema,
} from "./household-chat.types";

export async function listMessagesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { after } = GetHouseholdMessagesQuerySchema.parse(req.query);
    const result = await service.listMessages(
      req.prisma,
      req.params.householdId,
      req.userId!,
      after,
    );
    res.status(200).json(result);
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
    const input = SendHouseholdMessageSchema.parse(req.body);
    const result = await service.sendMessage(
      req.prisma,
      req.params.householdId,
      req.userId!,
      input,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
