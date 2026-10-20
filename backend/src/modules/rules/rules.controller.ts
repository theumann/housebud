import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./rules.service";
import { ProposeSchema, VoteSchema } from "./rules.types";

export async function getOverviewHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.getOverview(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function proposeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = ProposeSchema.parse(req.body);
    const result = await service.propose(
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

export async function voteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = VoteSchema.parse(req.body);
    const result = await service.vote(
      req.prisma,
      req.params.householdId,
      req.params.proposalId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function withdrawHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.withdraw(
      req.prisma,
      req.params.householdId,
      req.params.proposalId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function agreeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.agreeToRules(req.prisma, req.params.householdId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
