import { Prisma, type PrismaClient } from "@prisma/client";
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
import type { ProposeInput, VoteInput } from "./rules.types";

const userSelect = {
  select: {
    id: true,
    username: true,
    profile: {
      select: { displayName: true, firstName: true, lastName: true },
    },
  },
} as const;

const HISTORY_SIZE = 10;

const alreadyDecided = () => conflict("This proposal has already been decided");

// A second answer from the same person, sent at the same moment as the first.
function isDuplicateVote(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function activeMemberIds(prisma: PrismaClient, householdId: string) {
  return prisma.householdMember
    .findMany({
      where: { householdId, status: "active" },
      select: { userId: true },
    })
    .then((members) => members.map((m) => m.userId));
}

// Applies an open proposal to the rules. Does nothing if someone else
// settled it first.
async function adopt(
  prisma: PrismaClient,
  proposal: {
    id: string;
    householdId: string;
    kind: string;
    ruleId: string | null;
    title: string;
    details: string | null;
  },
) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.ruleProposal.updateMany({
      where: { id: proposal.id, status: "open" },
      data: { status: "adopted", decidedAt: now },
    });
    if (count === 0) return;

    if (proposal.kind === "add") {
      const rule = await tx.houseRule.create({
        data: {
          householdId: proposal.householdId,
          title: proposal.title,
          details: proposal.details,
          adoptedAt: now,
        },
      });
      await tx.ruleProposal.update({
        where: { id: proposal.id },
        data: { ruleId: rule.id },
      });
    } else if (proposal.kind === "change" && proposal.ruleId) {
      await tx.houseRule.updateMany({
        where: { id: proposal.ruleId },
        data: { title: proposal.title, details: proposal.details },
      });
    } else if (proposal.kind === "remove" && proposal.ruleId) {
      await tx.houseRule.deleteMany({ where: { id: proposal.ruleId } });
    }
  });
}

// Adopts every open proposal all current members have agreed to, including
// ones that were only waiting on someone who has since left.
async function settleOpenProposals(prisma: PrismaClient, householdId: string) {
  const [proposals, memberIds] = await Promise.all([
    prisma.ruleProposal.findMany({
      where: { householdId, status: "open" },
      include: { votes: true },
      orderBy: { createdAt: "asc" },
    }),
    activeMemberIds(prisma, householdId),
  ]);
  for (const p of proposals) {
    const agreed = memberIds.every((id) =>
      p.votes.some((v) => v.userId === id && v.agree),
    );
    if (agreed) await adopt(prisma, p);
  }
}

async function requireRulesAccess(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireActiveMember(prisma, householdId, userId);
  await requireEnabledModule(prisma, householdId, "rules");
  await settleOpenProposals(prisma, householdId);
  return member;
}

// Someone who joined after rules were adopted agrees to them once; founding
// members agreed to each rule as it was proposed.
function needsAgreement(
  member: { joinedAt: Date; rulesAgreedAt: Date | null },
  rules: { adoptedAt: Date }[],
) {
  const agreedSinceJoining =
    member.rulesAgreedAt !== null && member.rulesAgreedAt >= member.joinedAt;
  return (
    !agreedSinceJoining && rules.some((r) => r.adoptedAt < member.joinedAt)
  );
}

export async function getOverview(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireRulesAccess(prisma, householdId, userId);

  const [rules, open, history, members] = await Promise.all([
    prisma.houseRule.findMany({
      where: { householdId },
      orderBy: [{ adoptedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ruleProposal.findMany({
      where: { householdId, status: "open" },
      include: {
        proposedBy: userSelect,
        rule: true,
        votes: { include: { user: userSelect }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.ruleProposal.findMany({
      where: { householdId, status: { not: "open" } },
      include: {
        proposedBy: userSelect,
        votes: { where: { agree: false }, include: { user: userSelect } },
      },
      orderBy: { decidedAt: "desc" },
      take: HISTORY_SIZE,
    }),
    prisma.householdMember.findMany({
      where: { householdId, status: "active" },
      include: { user: userSelect },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return {
    rules: rules.map((r) => ({
      id: r.id,
      title: r.title,
      details: r.details,
      adoptedAt: r.adoptedAt,
    })),
    proposals: open.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      details: p.details,
      reason: p.reason,
      // The rule as it is now, for a change or removal.
      rule: p.rule
        ? { id: p.rule.id, title: p.rule.title, details: p.rule.details }
        : null,
      proposedBy: p.proposedBy,
      createdAt: p.createdAt,
      agreed: p.votes.map((v) => v.user),
      waitingOn: members
        .filter((m) => !p.votes.some((v) => v.userId === m.userId))
        .map((m) => m.user),
      myAnswer: p.votes.some((v) => v.userId === userId),
      canWithdraw: p.proposedByUserId === userId || member.role === "owner",
    })),
    history: history.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      details: p.details,
      status: p.status,
      decidedAt: p.decidedAt,
      proposedBy: p.proposedBy,
      declinedBy: p.votes[0]
        ? { user: p.votes[0].user, reason: p.votes[0].reason }
        : null,
    })),
    needsMyAgreement: needsAgreement(member, rules),
    notAgreed: members
      .filter((m) => m.userId !== userId && needsAgreement(m, rules))
      .map((m) => m.user),
  };
}

async function findOpenProposal(
  prisma: PrismaClient,
  householdId: string,
  proposalId: string,
) {
  const proposal = await prisma.ruleProposal.findFirst({
    where: { id: proposalId, householdId },
    include: { votes: true },
  });
  if (!proposal) throw notFound("Proposal not found");
  if (proposal.status !== "open") throw alreadyDecided();
  return proposal;
}

async function proposalStatus(prisma: PrismaClient, proposalId: string) {
  const { id, status, ruleId } = await prisma.ruleProposal.findUniqueOrThrow({
    where: { id: proposalId },
  });
  return { id, status, ruleId };
}

export async function propose(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  input: ProposeInput,
) {
  await requireRulesAccess(prisma, householdId, userId);

  let text: { title: string; details: string | null };
  if (input.kind === "add") {
    text = { title: input.title, details: input.details || null };
  } else {
    const rule = await prisma.houseRule.findFirst({
      where: { id: input.ruleId, householdId },
    });
    if (!rule) throw notFound("Rule not found");
    const pending = await prisma.ruleProposal.count({
      where: { ruleId: rule.id, status: "open" },
    });
    if (pending > 0) {
      throw conflict("There's already an open proposal for this rule");
    }
    if (input.kind === "remove") {
      text = { title: rule.title, details: rule.details };
    } else {
      text = { title: input.title, details: input.details || null };
      if (text.title === rule.title && text.details === rule.details) {
        throw badRequest("The proposed rule is the same as the current one");
      }
    }
  }

  const proposal = await prisma.ruleProposal.create({
    data: {
      householdId,
      kind: input.kind,
      ruleId: input.kind === "add" ? null : input.ruleId,
      ...text,
      reason: input.reason || null,
      proposedByUserId: userId,
      votes: { create: { userId, agree: true } },
    },
  });
  await settleOpenProposals(prisma, householdId);
  return proposalStatus(prisma, proposal.id);
}

export async function vote(
  prisma: PrismaClient,
  householdId: string,
  proposalId: string,
  userId: string,
  input: VoteInput,
) {
  await requireRulesAccess(prisma, householdId, userId);
  const proposal = await findOpenProposal(prisma, householdId, proposalId);
  if (proposal.votes.some((v) => v.userId === userId)) {
    throw conflict("You already answered this proposal");
  }

  try {
    if (input.agree) {
      await prisma.ruleVote.create({
        data: { proposalId, userId, agree: true },
      });
    } else {
      // Only while it's still open: the last "agree" may have adopted it
      // since it was read.
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.ruleProposal.updateMany({
          where: { id: proposalId, status: "open" },
          data: { status: "declined", decidedAt: new Date() },
        });
        if (count === 0) throw alreadyDecided();
        await tx.ruleVote.create({
          data: {
            proposalId,
            userId,
            agree: false,
            reason: input.reason || null,
          },
        });
      });
    }
  } catch (err) {
    if (isDuplicateVote(err)) {
      throw conflict("You already answered this proposal");
    }
    throw err;
  }
  if (input.agree) await settleOpenProposals(prisma, householdId);
  return proposalStatus(prisma, proposalId);
}

export async function withdraw(
  prisma: PrismaClient,
  householdId: string,
  proposalId: string,
  userId: string,
) {
  const member = await requireRulesAccess(prisma, householdId, userId);
  const proposal = await findOpenProposal(prisma, householdId, proposalId);
  if (proposal.proposedByUserId !== userId && member.role !== "owner") {
    throw forbidden(
      "Only whoever proposed this, or the owner, can withdraw it",
    );
  }

  const { count } = await prisma.ruleProposal.updateMany({
    where: { id: proposalId, status: "open" },
    data: { status: "withdrawn", decidedAt: new Date() },
  });
  if (count === 0) throw alreadyDecided();
  return proposalStatus(prisma, proposalId);
}

export async function agreeToRules(
  prisma: PrismaClient,
  householdId: string,
  userId: string,
) {
  const member = await requireRulesAccess(prisma, householdId, userId);
  await prisma.householdMember.update({
    where: { id: member.id },
    data: { rulesAgreedAt: new Date() },
  });
}
