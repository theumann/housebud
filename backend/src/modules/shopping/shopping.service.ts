import type { PrismaClient } from "@prisma/client";
import { notFound } from "../../errors/http.error";
import {
  requireActiveMember,
  requireEnabledModule,
} from "../household/household.service";
import type {
  CreateShoppingItemInput,
  UpdateShoppingItemInput,
} from "./shopping.types";

const userSelect = {
  select: {
    id: true,
    username: true,
    profile: {
      select: { displayName: true, firstName: true, lastName: true },
    },
  },
} as const;

const itemInclude = {
  addedByUser: userSelect,
  checkedByUser: userSelect,
} as const;

async function requireShoppingAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireActiveMember(prisma, householdId, userId);
  await requireEnabledModule(prisma, householdId, "shopping");
}

async function findItem(
  prisma: PrismaClient,
  householdId: string,
  itemId: string,
) {
  const item = await prisma.shoppingItem.findFirst({
    where: { id: itemId, householdId },
  });
  if (!item) throw notFound("Item not found");
  return item;
}

export async function listItems(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireShoppingAccess(prisma, householdId, userId);

  return prisma.shoppingItem.findMany({
    where: { householdId },
    include: itemInclude,
    orderBy: { createdAt: "asc" },
  });
}

export async function addItem(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: CreateShoppingItemInput,
) {
  await requireShoppingAccess(prisma, householdId, userId);

  return prisma.shoppingItem.create({
    data: {
      householdId,
      name: input.name,
      quantity: input.quantity || null,
      addedByUserId: userId,
    },
    include: itemInclude,
  });
}

export async function updateItem(
  prisma: PrismaClient,
  householdId: string,
  itemId: string,
  userId: string,
  input: UpdateShoppingItemInput,
) {
  await requireShoppingAccess(prisma, householdId, userId);
  const item = await findItem(prisma, householdId, itemId);

  // Checking an already-checked item keeps whoever checked it first.
  if (input.checked === (item.checkedAt !== null)) {
    return prisma.shoppingItem.findUniqueOrThrow({
      where: { id: itemId },
      include: itemInclude,
    });
  }

  return prisma.shoppingItem.update({
    where: { id: itemId },
    data: input.checked
      ? { checkedAt: new Date(), checkedByUserId: userId }
      : { checkedAt: null, checkedByUserId: null },
    include: itemInclude,
  });
}

export async function removeItem(
  prisma: PrismaClient,
  householdId: string,
  itemId: string,
  userId: string,
) {
  await requireShoppingAccess(prisma, householdId, userId);
  await findItem(prisma, householdId, itemId);

  await prisma.shoppingItem.delete({ where: { id: itemId } });
}

export async function clearChecked(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  await requireShoppingAccess(prisma, householdId, userId);

  const { count } = await prisma.shoppingItem.deleteMany({
    where: { householdId, checkedAt: { not: null } },
  });
  return { count };
}
