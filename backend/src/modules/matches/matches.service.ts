import type { PrismaClient } from "@prisma/client";

type MatchCandidate = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string;
  age: number | null;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  score: number | null; // 0–100 or null
  coverage: number; // 0–1
  hasMinCompatData: boolean;
};

type ActiveQuestion = {
  id: string;
};

type CandidateProfile = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string;
  birthDate: Date;
  school: string;
  collegeYear: string;
  targetCity: string;
  targetState: string;
  targetZip: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
};

type CandidateUser = {
  id: string;
  isActive: boolean;
  profile: CandidateProfile | null;
};

function calculateAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export async function getMatchesForUser(
  prisma: PrismaClient,
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ items: MatchCandidate[]; page: number; total: number }> {
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 50) limit = 50;

  // 1) Get current user's profile (for targetZip & location)
  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!me || !me.profile) {
    const err: any = new Error("Profile not found for current user");
    err.status = 400;
    throw err;
  }

  const myProfile = me.profile;
  const myZip = myProfile.targetZip;
  const zipPrefix = myZip.slice(0, 3); // simple "nearby" heuristic for MVP

  // 2) Get userIds already in 3+ accepted rooms (we'll exclude them)
  const acceptedParticipants = await prisma.chatRoomParticipant.findMany({
    where: { status: "accepted" },
    select: { userId: true },
  });

  const roomCountByUser: Record<string, number> = {};
  for (const p of acceptedParticipants) {
    roomCountByUser[p.userId] = (roomCountByUser[p.userId] || 0) + 1;
  }

  const busyUserIds = Object.entries(roomCountByUser)
    .filter(([_, count]) => count >= 3)
    .map(([id]) => id);

  // 3) Get active questions (for coverage & score)
  const activeQuestions = (await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    select: { id: true },
  })) as ActiveQuestion[];

  const activeQuestionIds = activeQuestions.map((q) => q.id);
  const totalActive = activeQuestionIds.length;

  // 4) Get candidate users (same/nearby zip, not me, not busy, active)
  const candidates = (await prisma.user.findMany({
    where: {
      isActive: true,
      id: {
        not: userId,
        notIn: busyUserIds,
      },
      profile: {
        targetZip: {
          startsWith: zipPrefix,
        },
      },
    },
    include: {
      profile: true,
    },
  })) as CandidateUser[];

  if (candidates.length === 0) {
    return { items: [], page, total: 0 };
  }

  const candidateIds = candidates.map((u) => u.id);

  // 5) Fetch all answers for me + candidates in one shot
  const allUserIds = [userId, ...candidateIds];

  const allAnswers = await prisma.compatibilityAnswer.findMany({
    where: {
      userId: { in: allUserIds },
      questionId: totalActive > 0 ? { in: activeQuestionIds } : undefined,
    },
    select: {
      userId: true,
      questionId: true,
      value: true,
    },
  });

  const answersByUser: Record<string, Map<string, string>> = {};
  for (const ans of allAnswers) {
    if (!answersByUser[ans.userId]) {
      answersByUser[ans.userId] = new Map<string, string>();
    }
    answersByUser[ans.userId].set(ans.questionId, ans.value);
  }

  const myAnswers = answersByUser[userId] || new Map<string, string>();

  // helper to compute coverage / hasMinCompatData
  function computeCoverage(id: string) {
    if (totalActive === 0) {
      return { coverage: 0, hasMinCompatData: false };
    }
    const answers = answersByUser[id];
    const answeredCount = answers ? answers.size : 0;
    const coverage = answeredCount / totalActive;
    const hasMinCompatData = coverage >= 0.2;
    return { coverage, hasMinCompatData };
  }

  // helper to compute compatibility score (0–100 or null)
  function computeScore(candidateId: string): number | null {
    if (totalActive === 0) return null;

    const candidateAnswers = answersByUser[candidateId];
    if (!candidateAnswers) return null;

    const myStats = computeCoverage(userId);
    const candidateStats = computeCoverage(candidateId);

    if (!myStats.hasMinCompatData || !candidateStats.hasMinCompatData) {
      return null;
    }

    let shared = 0;
    let matches = 0;

    for (const [qId, myValue] of myAnswers.entries()) {
      const theirValue = candidateAnswers.get(qId);
      if (theirValue !== undefined) {
        shared++;
        if (theirValue === myValue) {
          matches++;
        }
      }
    }

    if (shared === 0) return null;

    const ratio = matches / shared; // 0–1
    const score = Math.round(ratio * 100); // 0–100
    return score;
  }

  // 6) Build candidate list with score + coverage
  const matchCandidates: MatchCandidate[] = candidates.map((u) => {
    const profile = u.profile!;
    const age = calculateAge(profile.birthDate);

    const { coverage, hasMinCompatData } = computeCoverage(u.id);
    const score = computeScore(u.id);

    return {
      userId: u.id,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName ?? null,
      age,
      school: profile.school,
      collegeYear: profile.collegeYear,
      targetCity: profile.targetCity,
      targetState: profile.targetState,
      targetZip: profile.targetZip,
      bio: profile.bio ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      createdAt: profile.createdAt,
      score,
      coverage,
      hasMinCompatData,
    };
  });

  // 7) Sort: scored first (desc), then no-score by same zip + recency
  const scored = matchCandidates.filter((c) => c.score !== null);
  const unscored = matchCandidates.filter((c) => c.score === null);

  scored.sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    if (sb !== sa) return sb - sa;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  unscored.sort((a, b) => {
    const aSameZip = a.targetZip === myZip ? 0 : 1;
    const bSameZip = b.targetZip === myZip ? 0 : 1;
    if (aSameZip !== bSameZip) return aSameZip - bSameZip;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const sorted = [...scored, ...unscored];

  const total = sorted.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const pagedItems = sorted.slice(start, end);

  return {
    items: pagedItems,
    page,
    total,
  };
}
