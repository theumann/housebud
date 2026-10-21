import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./calendar.service";
import { EventInputSchema, RangeSchema, SkipSchema } from "./calendar.types";

export async function listOccurrencesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const range = RangeSchema.parse(req.query);
    const result = await service.listOccurrences(
      req.prisma,
      req.params.householdId,
      req.userId!,
      range,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createEventHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = EventInputSchema.parse(req.body);
    const result = await service.createEvent(
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

export async function updateEventHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = EventInputSchema.parse(req.body);
    const result = await service.updateEvent(
      req.prisma,
      req.params.householdId,
      req.params.eventId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteEventHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await service.deleteEvent(
      req.prisma,
      req.params.householdId,
      req.params.eventId,
      req.userId!,
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function skipOccurrenceHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = SkipSchema.parse(req.body);
    const result = await service.skipOccurrence(
      req.prisma,
      req.params.householdId,
      req.params.eventId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
