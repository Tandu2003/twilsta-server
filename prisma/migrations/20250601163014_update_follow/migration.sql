-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "follows" ADD COLUMN     "status" "FollowStatus" NOT NULL DEFAULT 'ACCEPTED';

-- CreateIndex
CREATE INDEX "follows_followerId_status_idx" ON "follows"("followerId", "status");

-- CreateIndex
CREATE INDEX "follows_followingId_status_idx" ON "follows"("followingId", "status");
