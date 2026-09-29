import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import * as service from "./household.service";
import {
  AcceptInviteSchema,
  CreateHouseholdSchema,
  InviteSchema,
  JoinByCodeSchema,
  UpdateHouseholdSchema,
  UpdateSettingsSchema,
} from "./household.types";

export async function createHouseholdHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateHouseholdSchema.parse(req.body);
    const result = await service.createHousehold(
      req.prisma,
      req.userId!,
      input,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMyHouseholdsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.listMyHouseholds(req.prisma, req.userId!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getHouseholdHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.getHousehold(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateHouseholdHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateHouseholdSchema.parse(req.body);
    const result = await service.updateHousehold(
      req.prisma,
      req.params.householdId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateSettingsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = UpdateSettingsSchema.parse(req.body);
    const result = await service.updateSettings(
      req.prisma,
      req.params.householdId,
      req.userId!,
      input,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function regenerateJoinCodeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.regenerateJoinCode(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = InviteSchema.parse(req.body);
    const invite = await service.inviteByEmail(
      req.prisma,
      req.params.householdId,
      req.userId!,
      input,
    );
    res.status(201).json({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function listInvitesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.listInvites(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeInviteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.revokeInvite(
      req.prisma,
      req.params.householdId,
      req.params.inviteId,
      req.userId!,
    );
    res.status(200).json(result);
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
    const { token } = AcceptInviteSchema.parse(req.body);
    const result = await service.acceptInvite(req.prisma, req.userId!, token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function joinByCodeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { joinCode } = JoinByCodeSchema.parse(req.body);
    const result = await service.joinByCode(req.prisma, req.userId!, joinCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function leaveHouseholdHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.leaveHousehold(
      req.prisma,
      req.params.householdId,
      req.userId!,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.removeMember(
      req.prisma,
      req.params.householdId,
      req.userId!,
      req.params.userId,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function transferOwnershipHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.transferOwnership(
      req.prisma,
      req.params.householdId,
      req.userId!,
      req.params.userId,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
