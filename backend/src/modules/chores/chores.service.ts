import type { Chore, PrismaClient } from "@prisma/client";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../errors/http.error";
import {
  requireActiveMember,
  requireEnabledModule,
} from "../household/household.service";
import type {
  CompleteChoreInput,
  CreateChoreInput,
  Repeat,
  RepeatUnit,
  UpdateChoreInput,
} from "./chores.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;

const toDateString = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) =>
  new Date(d.getTime() + days * DAY_MS);

// Moves by calendar months onto anchorDay, or the month's last day when it's
// shorter (Jan 31 -> Feb 28 -> Mar 31).
function addMonths(d: Date, months: number, anchorDay: number) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
}

function step(d: Date, repeat: Repeat, anchorDay: number) {
  switch (repeat.unit) {
    case "day":
      return addDays(d, repeat.every);
    case "week":
      return addDays(d, repeat.every * 7);
    case "month":
      return addMonths(d, repeat.every, anchorDay);
    case "quarter":
      return addMonths(d, repeat.every * 3, anchorDay);
  }
}

// Next due date on the original schedule: a late chore keeps its weekday
// (or day of the month), and occurrences missed entirely are skipped rather
// than piling up.
export function nextDueDate(
  dueDate: Date,
  repeat: Repeat,
  anchorDay: number,
  completedOn: Date,
) {
  let next = step(dueDate, repeat, anchorDay);
  while (next <= completedOn) next = step(next, repeat, anchorDay);
  return next;
}

function repeatOf(chore: Chore): Repeat | null {
  return chore.repeatEvery === null
    ? null
    : { every: chore.repeatEvery, unit: chore.repeatUnit as RepeatUnit };
}

const repeatData = (repeat: Repeat | null) => ({
  repeatEvery: repeat?.every ?? null,
  repeatUnit: repeat?.unit ?? null,
});

async function requireChoresAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireActiveMember(prisma, householdId, userId);
  await requireEnabledModule(prisma, householdId, "chores");
}

async function activeMemberIds(prisma: PrismaClient, householdId: string) {
  const members = await prisma.householdMember.findMany({
    where: { householdId, status: "active" },
    select: { userId: true },
  });
  return new Set(members.map((m) => m.userId));
}

function validateRotation(rotation: string[], memberIds: Set<string>) {
  if (new Set(rotation).size !== rotation.length) {
    throw badRequest("Someone is in the rotation twice");
  }
  if (rotation.some((id) => !memberIds.has(id))) {
    throw badRequest("Everyone in the rotation must be a household member");
  }
}

// Index of the first rotation member at or after `from` who is still in the
// household; null when nobody in the rotation is.
function nextMemberIndex(
  rotation: string[],
  from: number,
  memberIds: Set<string>,
) {
  for (let i = 0; i < rotation.length; i++) {
    const index = (from + i) % rotation.length;
    if (memberIds.has(rotation[index])) return index;
  }
  return null;
}

// The rotation in turn order (whoever's turn it is first), members only.
function serializeChore(chore: Chore, memberIds: Set<string>) {
  const turn =
    nextMemberIndex(chore.rotation, chore.rotationIndex, memberIds) ?? 0;
  const rotation = [
    ...chore.rotation.slice(turn),
    ...chore.rotation.slice(0, turn),
  ].filter((id) => memberIds.has(id));

  return {
    id: chore.id,
    name: chore.name,
    repeat: repeatOf(chore),
    dueDate: toDateString(chore.dueDate),
    rotation,
    assigneeUserId: rotation[0] ?? null,
    startedAt: chore.startedAt,
    startedByUserId: chore.startedByUserId,
    createdAt: chore.createdAt,
  };
}

async function findChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
) {
  const chore = await prisma.chore.findFirst({
    where: { id: choreId, householdId, archivedAt: null },
  });
  if (!chore) throw notFound("Chore not found");
  return chore;
}

export async function listChores(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const memberIds = await activeMemberIds(prisma, householdId);

  const chores = await prisma.chore.findMany({
    where: { householdId, archivedAt: null },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return chores.map((c) => serializeChore(c, memberIds));
}

export async function createChore(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: CreateChoreInput,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const memberIds = await activeMemberIds(prisma, householdId);
  validateRotation(input.rotation, memberIds);

  const chore = await prisma.chore.create({
    data: {
      householdId,
      name: input.name,
      ...repeatData(input.repeat),
      dueDate: input.dueDate,
      anchorDay: input.dueDate.getUTCDate(),
      rotation: input.rotation,
      createdByUserId: userId,
    },
  });
  return serializeChore(chore, memberIds);
}

export async function updateChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
  userId: string,
  input: UpdateChoreInput,
) {
  await requireChoresAccess(prisma, householdId, userId);
  await findChore(prisma, householdId, choreId);
  const memberIds = await activeMemberIds(prisma, householdId);
  if (input.rotation) validateRotation(input.rotation, memberIds);

  const chore = await prisma.chore.update({
    where: { id: choreId },
    data: {
      name: input.name,
      ...(input.repeat !== undefined && repeatData(input.repeat)),
      ...(input.dueDate && {
        dueDate: input.dueDate,
        anchorDay: input.dueDate.getUTCDate(),
      }),
      // A new rotation comes in turn order, so its first member is up.
      ...(input.rotation && { rotation: input.rotation, rotationIndex: 0 }),
    },
  });
  return serializeChore(chore, memberIds);
}

export async function removeChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);
  await findChore(prisma, householdId, choreId);

  await prisma.chore.delete({ where: { id: choreId } });
}

export async function startChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const memberIds = await activeMemberIds(prisma, householdId);

  // Only if nobody (still in the household) has started it already.
  const { count } = await prisma.chore.updateMany({
    where: {
      id: choreId,
      householdId,
      archivedAt: null,
      OR: [
        { startedByUserId: null },
        { startedByUserId: { notIn: [...memberIds] } },
      ],
    },
    data: { startedAt: new Date(), startedByUserId: userId },
  });
  if (count === 0) {
    await findChore(prisma, householdId, choreId);
    throw conflict("Someone already started this chore");
  }

  const chore = await prisma.chore.findUniqueOrThrow({
    where: { id: choreId },
  });
  return serializeChore(chore, memberIds);
}

export async function stopChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const chore = await findChore(prisma, householdId, choreId);
  if (chore.startedByUserId !== userId) {
    throw forbidden("Only whoever started this chore can stop it");
  }
  const memberIds = await activeMemberIds(prisma, householdId);

  const updated = await prisma.chore.update({
    where: { id: choreId },
    data: { startedAt: null, startedByUserId: null },
  });
  return serializeChore(updated, memberIds);
}

export async function completeChore(
  prisma: PrismaClient,
  householdId: string,
  choreId: string,
  userId: string,
  input: CompleteChoreInput,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const chore = await findChore(prisma, householdId, choreId);
  const memberIds = await activeMemberIds(prisma, householdId);
  const repeat = repeatOf(chore);

  // The turn passes on from whoever's turn it was, even if someone else
  // did it.
  const turn = nextMemberIndex(chore.rotation, chore.rotationIndex, memberIds);
  const rotationIndex =
    turn === null
      ? chore.rotationIndex
      : (nextMemberIndex(chore.rotation, turn + 1, memberIds) ?? turn);

  const updated = await prisma.$transaction(async (tx) => {
    // Matching on the due date makes a second "done" for the same occurrence
    // (two roommates clicking at once) fail instead of skipping a turn.
    const { count } = await tx.chore.updateMany({
      where: { id: choreId, dueDate: chore.dueDate, archivedAt: null },
      data: {
        startedAt: null,
        startedByUserId: null,
        ...(repeat === null
          ? { archivedAt: new Date() }
          : {
              dueDate: nextDueDate(
                chore.dueDate,
                repeat,
                chore.anchorDay,
                input.completedOn,
              ),
              rotationIndex,
            }),
      },
    });
    if (count === 0) throw conflict("This chore was just marked done");

    await tx.choreCompletion.create({
      data: {
        choreId,
        doneByUserId: userId,
        dueDate: chore.dueDate,
        completedOn: input.completedOn,
        previousRotationIndex: chore.rotationIndex,
      },
    });
    return tx.chore.findUniqueOrThrow({ where: { id: choreId } });
  });

  return updated.archivedAt ? null : serializeChore(updated, memberIds);
}

// Puts a chore back the way it was before its latest completion: due date,
// turn, and (for a one-off chore) back on the list.
export async function undoCompletion(
  prisma: PrismaClient,
  householdId: string,
  completionId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);
  const completion = await prisma.choreCompletion.findFirst({
    where: { id: completionId, chore: { householdId } },
  });
  if (!completion) throw notFound("Completion not found");

  const latest = await prisma.choreCompletion.findFirst({
    where: { choreId: completion.choreId },
    orderBy: { createdAt: "desc" },
  });
  if (latest?.id !== completion.id) {
    throw conflict("Only a chore's latest completion can be undone");
  }
  const memberIds = await activeMemberIds(prisma, householdId);

  const chore = await prisma.$transaction(async (tx) => {
    const { count } = await tx.choreCompletion.deleteMany({
      where: { id: completionId },
    });
    if (count === 0) throw conflict("This was just undone");

    return tx.chore.update({
      where: { id: completion.choreId },
      data: {
        dueDate: completion.dueDate,
        rotationIndex: completion.previousRotationIndex,
        archivedAt: null,
        startedAt: null,
        startedByUserId: null,
      },
    });
  });
  return serializeChore(chore, memberIds);
}

export async function listCompletions(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireChoresAccess(prisma, householdId, userId);

  const completions = await prisma.choreCompletion.findMany({
    where: { chore: { householdId } },
    include: { chore: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const latestPerChore = await prisma.choreCompletion.findMany({
    where: { choreId: { in: completions.map((c) => c.choreId) } },
    orderBy: { createdAt: "desc" },
    distinct: ["choreId"],
    select: { id: true },
  });
  const undoable = new Set(latestPerChore.map((c) => c.id));

  return completions.map((c) => ({
    id: c.id,
    choreId: c.choreId,
    choreName: c.chore.name,
    doneByUserId: c.doneByUserId,
    dueDate: toDateString(c.dueDate),
    completedOn: toDateString(c.completedOn),
    undoable: undoable.has(c.id),
  }));
}
