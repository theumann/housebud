import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./expenses.service";
import {
  CreateExpenseSchema,
  CreateSettlementSchema,
  UpdateExpenseSchema,
  UpdateSettlementSchema,
} from "./expenses.types";

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

export async function createExpenseHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateExpenseSchema.parse(req.body);
    const result = await service.createExpense(
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

export async function updateExpenseHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateExpenseSchema.parse(req.body);
    const result = await service.updateExpense(
      req.prisma,
      req.params.householdId,
      req.params.expenseId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteExpenseHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.deleteExpense(
      req.prisma,
      req.params.householdId,
      req.params.expenseId,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createSettlementHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateSettlementSchema.parse(req.body);
    const result = await service.createSettlement(
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

export async function updateSettlementHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateSettlementSchema.parse(req.body);
    const result = await service.updateSettlement(
      req.prisma,
      req.params.householdId,
      req.params.settlementId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteSettlementHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.deleteSettlement(
      req.prisma,
      req.params.householdId,
      req.params.settlementId,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
