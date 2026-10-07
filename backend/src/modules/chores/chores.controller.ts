import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./chores.service";
import {
  CompleteChoreSchema,
  CreateChoreSchema,
  UpdateChoreSchema,
} from "./chores.types";

export async function listChoresHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.listChores(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateChoreSchema.parse(req.body);
    const result = await service.createChore(
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

export async function updateChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateChoreSchema.parse(req.body);
    const result = await service.updateChore(
      req.prisma,
      req.params.householdId,
      req.params.choreId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.removeChore(
      req.prisma,
      req.params.householdId,
      req.params.choreId,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function completeChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CompleteChoreSchema.parse(req.body);
    const chore = await service.completeChore(
      req.prisma,
      req.params.householdId,
      req.params.choreId,
      req.userId!,
      input,
    );
    // chore is null when a one-off chore was done (it's archived).
    res.status(200).json({ chore });
  } catch (err) {
    next(err);
  }
}

export async function listCompletionsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.listCompletions(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function startChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.startChore(
      req.prisma,
      req.params.householdId,
      req.params.choreId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function stopChoreHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.stopChore(
      req.prisma,
      req.params.householdId,
      req.params.choreId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function undoCompletionHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.undoCompletion(
      req.prisma,
      req.params.householdId,
      req.params.completionId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
