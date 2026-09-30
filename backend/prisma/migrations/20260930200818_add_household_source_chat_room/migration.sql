/*
  Warnings:

  - A unique constraint covering the columns `[sourceChatRoomId]` on the table `Household` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "sourceChatRoomId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Household_sourceChatRoomId_key" ON "Household"("sourceChatRoomId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_sourceChatRoomId_fkey" FOREIGN KEY ("sourceChatRoomId") REFERENCES "ChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
