-- AlterTable
ALTER TABLE "HouseholdMember" ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing members have been there since they were added.
UPDATE "HouseholdMember" SET "joinedAt" = "createdAt";

-- AlterTable
ALTER TABLE "HouseholdSettings" ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HouseholdMessage" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdMessage_householdId_createdAt_idx" ON "HouseholdMessage"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "HouseholdMessage" ADD CONSTRAINT "HouseholdMessage_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMessage" ADD CONSTRAINT "HouseholdMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

