-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'LATE', 'WAIVED');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('CASH', 'COINS');

-- CreateEnum
CREATE TYPE "BoardKind" AS ENUM ('ACTIVITY', 'DONATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "netlifyIdentityId" TEXT,
    "passwordHash" TEXT,
    "inGameName" TEXT NOT NULL,
    "playerId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "contact" TEXT,
    "hiddenFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "inviteTokenHash" TEXT,
    "inviteExpires" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetExpires" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inGameName" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "level" INTEGER,
    "power" TEXT,
    "weeklyActivity" TEXT,
    "stats" JSONB,
    "reason" TEXT NOT NULL,
    "references" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "decisionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "weeklyMoneyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weeklyCoinCost" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceAssignment" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DonationType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "donatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceExpense" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyDonationStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "met" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyDonationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pinCheck" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostUpvote" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PostUpvote_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB NOT NULL,
    "eligibleRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionSelected" TEXT NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "visibleToRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER,
    "memberCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "kind" "BoardKind" NOT NULL,
    "name" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_netlifyIdentityId_key" ON "User"("netlifyIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_inGameName_key" ON "User"("inGameName");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteTokenHash_key" ON "User"("inviteTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Application_tokenHash_key" ON "Application"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_key" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Office_name_key" ON "Office"("name");

-- CreateIndex
CREATE INDEX "MaintenanceAssignment_weekStart_idx" ON "MaintenanceAssignment"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAssignment_officeId_userId_weekStart_key" ON "MaintenanceAssignment"("officeId", "userId", "weekStart");

-- CreateIndex
CREATE INDEX "Donation_type_userId_idx" ON "Donation"("type", "userId");

-- CreateIndex
CREATE INDEX "Donation_donatedAt_idx" ON "Donation"("donatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceExpense_weekStart_key" ON "MaintenanceExpense"("weekStart");

-- CreateIndex
CREATE INDEX "WeeklyDonationStatus_weekStart_idx" ON "WeeklyDonationStatus"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyDonationStatus_userId_weekStart_key" ON "WeeklyDonationStatus"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForumCategory_name_key" ON "ForumCategory"("name");

-- CreateIndex
CREATE INDEX "ForumThread_categoryId_idx" ON "ForumThread"("categoryId");

-- CreateIndex
CREATE INDEX "ForumPost_threadId_idx" ON "ForumPost"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_slug_key" ON "WikiPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRecord_voteId_userId_key" ON "VoteRecord"("voteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storedName_key" ON "Document"("storedName");

-- CreateIndex
CREATE INDEX "AuditSnapshot_date_idx" ON "AuditSnapshot"("date");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_kind_rank_idx" ON "LeaderboardEntry"("kind", "rank");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAssignment" ADD CONSTRAINT "MaintenanceAssignment_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAssignment" ADD CONSTRAINT "MaintenanceAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDonationStatus" ADD CONSTRAINT "WeeklyDonationStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostUpvote" ADD CONSTRAINT "PostUpvote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostUpvote" ADD CONSTRAINT "PostUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
