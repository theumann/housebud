-- AlterTable
ALTER TABLE "ChatRoomParticipant" ADD COLUMN "acceptedAt" TIMESTAMP(3);

-- Backfill accepted participants with the best record there is: an owner
-- joined when their row was created; a member's row last changed when they
-- accepted (a handover since then makes it later than it should be).
UPDATE "ChatRoomParticipant"
SET "acceptedAt" = CASE WHEN "role" = 'owner' THEN "createdAt" ELSE "updatedAt" END
WHERE "status" = 'accepted';
