import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, forbidden, notFound } from "../../errors/http.error";
import {
  requireActiveMember,
  requireEnabledModule,
} from "../household/household.service";
import type {
  CreateExpenseInput,
  CreateSettlementInput,
  UpdateExpenseInput,
  UpdateSettlementInput,
} from "./expenses.types";

const userSelect = {
  select: {
    id: true,
    username: true,
    profile: {
      select: { displayName: true, firstName: true, lastName: true },
    },
  },
} as const;

const expenseInclude = {
  paidByUser: userSelect,
  createdByUser: userSelect,
  shares: { include: { user: userSelect }, orderBy: { userId: "asc" } },
} as const;

const settlementInclude = {
  fromUser: userSelect,
  toUser: userSelect,
  createdByUser: userSelect,
} as const;

const toDateString = (d: Date) => d.toISOString().slice(0, 10);

type Member = Awaited<ReturnType<typeof requireActiveMember>>;

async function requireExpensesAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);
  const settings = await requireEnabledModule(prisma, householdId, "expenses");
  return { member, settings };
}

// The creator, the people the money moved between, or the owner.
function canManage(
  member: Member,
  createdByUserId: string | null,
  involvedUserIds: string[],
) {
  return (
    member.role === "owner" ||
    member.userId === createdByUserId ||
    involvedUserIds.includes(member.userId)
  );
}

async function requireActiveMembers(
  prisma: PrismaClient,
  householdId: string,
  userIds: string[],
) {
  if (userIds.length === 0) return;
  const count = await prisma.householdMember.count({
    where: { householdId, userId: { in: userIds }, status: "active" },
  });
  if (count !== new Set(userIds).size) {
    throw badRequest(
      "Only current household members can be part of an expense",
    );
  }
}

// Equal shares that add up to the total; the leftover cents go one each to
// the first members by user id, so the same split always comes out the same.
export function splitEqually(amountCents: number, userIds: string[]) {
  const sorted = [...userIds].sort();
  const base = Math.floor(amountCents / sorted.length);
  const remainder = amountCents % sorted.length;
  return sorted.map((userId, i) => ({
    userId,
    amountCents: base + (i < remainder ? 1 : 0),
  }));
}

// Positive: the household owes them; negative: they owe.
export function computeBalances(
  expenses: {
    paidByUserId: string;
    amountCents: number;
    shares: { userId: string; amountCents: number }[];
  }[],
  settlements: { fromUserId: string; toUserId: string; amountCents: number }[],
) {
  const net = new Map<string, number>();
  const add = (userId: string, cents: number) =>
    net.set(userId, (net.get(userId) ?? 0) + cents);

  for (const e of expenses) {
    add(e.paidByUserId, e.amountCents);
    for (const s of e.shares) add(s.userId, -s.amountCents);
  }
  for (const s of settlements) {
    add(s.fromUserId, s.amountCents);
    add(s.toUserId, -s.amountCents);
  }
  return net;
}

// Few transfers that settle everyone: the biggest debtor pays the biggest
// creditor until one of them is even, then repeat.
export function suggestTransfers(net: Map<string, number>) {
  const byAmount = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0]);
  const creditors = [...net].filter(([, c]) => c > 0).sort(byAmount);
  const debtors = [...net]
    .filter(([, c]) => c < 0)
    .map(([id, c]): [string, number] => [id, -c])
    .sort(byAmount);

  const transfers: {
    fromUserId: string;
    toUserId: string;
    amountCents: number;
  }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i][1], creditors[j][1]);
    transfers.push({
      fromUserId: debtors[i][0],
      toUserId: creditors[j][0],
      amountCents: amount,
    });
    debtors[i][1] -= amount;
    creditors[j][1] -= amount;
    if (debtors[i][1] === 0) i++;
    if (creditors[j][1] === 0) j++;
  }
  return transfers;
}

async function findExpense(
  prisma: PrismaClient,
  householdId: string,
  expenseId: string,
) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, householdId },
    include: { shares: true },
  });
  if (!expense) throw notFound("Expense not found");
  return expense;
}

async function findSettlement(
  prisma: PrismaClient,
  householdId: string,
  settlementId: string,
) {
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, householdId },
  });
  if (!settlement) throw notFound("Payment not found");
  return settlement;
}

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;
type SettlementRow = Prisma.SettlementGetPayload<{
  include: typeof settlementInclude;
}>;

function toExpenseResponse(e: ExpenseRow, member: Member) {
  return {
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    spentOn: toDateString(e.spentOn),
    paidBy: e.paidByUser,
    createdBy: e.createdByUser,
    shares: e.shares.map((s) => ({ user: s.user, amountCents: s.amountCents })),
    canEdit: canManage(member, e.createdByUserId, [e.paidByUserId]),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function toSettlementResponse(s: SettlementRow, member: Member) {
  return {
    id: s.id,
    from: s.fromUser,
    to: s.toUser,
    amountCents: s.amountCents,
    paidOn: toDateString(s.paidOn),
    createdBy: s.createdByUser,
    canEdit: canManage(member, s.createdByUserId, [s.fromUserId, s.toUserId]),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function getOverview(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const { member, settings } = await requireExpensesAccess(
    prisma,
    householdId,
    userId,
  );

  const [expenses, settlements, members] = await Promise.all([
    prisma.expense.findMany({
      where: { householdId },
      include: expenseInclude,
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.settlement.findMany({
      where: { householdId },
      include: settlementInclude,
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.householdMember.findMany({
      where: { householdId },
      include: { user: userSelect },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const net = computeBalances(expenses, settlements);

  // Everyone still here, and anyone who left with money still open.
  const balances = members
    .filter((m) => m.status === "active" || (net.get(m.userId) ?? 0) !== 0)
    .map((m) => ({
      user: m.user,
      status: m.status,
      netCents: net.get(m.userId) ?? 0,
    }));

  return {
    currency: settings.currency,
    expenses: expenses.map((e) => toExpenseResponse(e, member)),
    settlements: settlements.map((s) => toSettlementResponse(s, member)),
    balances,
    transfers: suggestTransfers(net),
  };
}

export async function createExpense(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: CreateExpenseInput,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  await requireActiveMembers(prisma, householdId, [
    input.paidByUserId,
    ...input.splitWith,
  ]);

  if (input.shoppingItemIds.length > 0) {
    const items = await prisma.shoppingItem.count({
      where: {
        id: { in: input.shoppingItemIds },
        householdId,
        checkedAt: { not: null },
        expenseId: null,
      },
    });
    if (items !== new Set(input.shoppingItemIds).size) {
      throw badRequest(
        "Only checked items not already on an expense can be added",
      );
    }
  }

  const expense = await prisma.expense.create({
    data: {
      householdId,
      description: input.description,
      amountCents: input.amountCents,
      paidByUserId: input.paidByUserId,
      spentOn: input.spentOn,
      createdByUserId: userId,
      shares: { create: splitEqually(input.amountCents, input.splitWith) },
      shoppingItems: { connect: input.shoppingItemIds.map((id) => ({ id })) },
    },
    include: expenseInclude,
  });
  return toExpenseResponse(expense, member);
}

export async function updateExpense(
  prisma: PrismaClient,
  householdId: string,
  expenseId: string,
  userId: string,
  input: UpdateExpenseInput,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  const expense = await findExpense(prisma, householdId, expenseId);
  if (!canManage(member, expense.createdByUserId, [expense.paidByUserId])) {
    throw forbidden(
      "Only whoever added or paid this expense, or the owner, can change it",
    );
  }

  // People already on the expense can stay after leaving; anyone newly
  // added has to be a current member.
  const current = new Set([
    expense.paidByUserId,
    ...expense.shares.map((s) => s.userId),
  ]);
  const added = [input.paidByUserId, ...(input.splitWith ?? [])].filter(
    (id): id is string => id !== undefined && !current.has(id),
  );
  await requireActiveMembers(prisma, householdId, added);

  const resplit =
    input.amountCents !== undefined || input.splitWith !== undefined;
  const shares = splitEqually(
    input.amountCents ?? expense.amountCents,
    input.splitWith ?? expense.shares.map((s) => s.userId),
  );

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      description: input.description,
      amountCents: input.amountCents,
      paidByUserId: input.paidByUserId,
      spentOn: input.spentOn,
      ...(resplit && { shares: { deleteMany: {}, create: shares } }),
    },
    include: expenseInclude,
  });
  return toExpenseResponse(updated, member);
}

export async function deleteExpense(
  prisma: PrismaClient,
  householdId: string,
  expenseId: string,
  userId: string,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  const expense = await findExpense(prisma, householdId, expenseId);
  if (!canManage(member, expense.createdByUserId, [expense.paidByUserId])) {
    throw forbidden(
      "Only whoever added or paid this expense, or the owner, can delete it",
    );
  }

  await prisma.expense.delete({ where: { id: expenseId } });
}

// Payments can involve former members, so their open balances can be settled.
async function requireMembersEverPresent(
  prisma: PrismaClient,
  householdId: string,
  userIds: string[],
) {
  const count = await prisma.householdMember.count({
    where: { householdId, userId: { in: userIds } },
  });
  if (count !== new Set(userIds).size) {
    throw badRequest("Payments can only be between household members");
  }
}

export async function createSettlement(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: CreateSettlementInput,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  await requireMembersEverPresent(prisma, householdId, [
    input.fromUserId,
    input.toUserId,
  ]);

  const settlement = await prisma.settlement.create({
    data: { householdId, ...input, createdByUserId: userId },
    include: settlementInclude,
  });
  return toSettlementResponse(settlement, member);
}

export async function updateSettlement(
  prisma: PrismaClient,
  householdId: string,
  settlementId: string,
  userId: string,
  input: UpdateSettlementInput,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  const settlement = await findSettlement(prisma, householdId, settlementId);
  if (
    !canManage(member, settlement.createdByUserId, [
      settlement.fromUserId,
      settlement.toUserId,
    ])
  ) {
    throw forbidden(
      "Only whoever recorded this payment, the two people in it, or the owner, can change it",
    );
  }

  const fromUserId = input.fromUserId ?? settlement.fromUserId;
  const toUserId = input.toUserId ?? settlement.toUserId;
  if (fromUserId === toUserId) {
    throw badRequest("toUserId: Payer and recipient must be different");
  }
  await requireMembersEverPresent(prisma, householdId, [fromUserId, toUserId]);

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: input,
    include: settlementInclude,
  });
  return toSettlementResponse(updated, member);
}

export async function deleteSettlement(
  prisma: PrismaClient,
  householdId: string,
  settlementId: string,
  userId: string,
) {
  const { member } = await requireExpensesAccess(prisma, householdId, userId);
  const settlement = await findSettlement(prisma, householdId, settlementId);
  if (
    !canManage(member, settlement.createdByUserId, [
      settlement.fromUserId,
      settlement.toUserId,
    ])
  ) {
    throw forbidden(
      "Only whoever recorded this payment, the two people in it, or the owner, can delete it",
    );
  }

  await prisma.settlement.delete({ where: { id: settlementId } });
}
