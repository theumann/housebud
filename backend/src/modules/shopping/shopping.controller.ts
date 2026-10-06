import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./shopping.service";
import {
  CreateShoppingItemSchema,
  UpdateShoppingItemSchema,
} from "./shopping.types";

export async function listItemsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.listItems(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function addItemHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateShoppingItemSchema.parse(req.body);
    const result = await service.addItem(
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

export async function updateItemHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateShoppingItemSchema.parse(req.body);
    const result = await service.updateItem(
      req.prisma,
      req.params.householdId,
      req.params.itemId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeItemHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.removeItem(
      req.prisma,
      req.params.householdId,
      req.params.itemId,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function clearCheckedHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.clearChecked(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
