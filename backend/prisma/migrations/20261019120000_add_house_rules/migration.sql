-- AlterTable
ALTER TABLE "HouseholdMember" ADD COLUMN     "rulesAgreedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HouseholdSettings" ADD COLUMN     "rulesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HouseRule" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProposal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ruleId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "reason" TEXT,
    "proposedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agree" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseRule_householdId_adoptedAt_idx" ON "HouseRule"("householdId", "adoptedAt");

-- CreateIndex
CREATE INDEX "RuleProposal_householdId_status_idx" ON "RuleProposal"("householdId", "status");

-- CreateIndex
CREATE INDEX "RuleVote_userId_idx" ON "RuleVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVote_proposalId_userId_key" ON "RuleVote"("proposalId", "userId");

-- AddForeignKey
ALTER TABLE "HouseRule" ADD CONSTRAINT "HouseRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProposal" ADD CONSTRAINT "RuleProposal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProposal" ADD CONSTRAINT "RuleProposal_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "HouseRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProposal" ADD CONSTRAINT "RuleProposal_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVote" ADD CONSTRAINT "RuleVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RuleProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVote" ADD CONSTRAINT "RuleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

