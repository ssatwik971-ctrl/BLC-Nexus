-- Weekly maintenance totals (admin-entered) and weekly minimum-donation status.
-- Apply after the Phase 1 baseline. Safe to re-run.
CREATE TABLE IF NOT EXISTS "MaintenanceExpense" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceExpense_weekStart_key" ON "MaintenanceExpense"("weekStart");

CREATE TABLE IF NOT EXISTS "WeeklyDonationStatus" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" DATE NOT NULL,
  "met" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyDonationStatus_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyDonationStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyDonationStatus_userId_weekStart_key" ON "WeeklyDonationStatus"("userId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyDonationStatus_weekStart_idx" ON "WeeklyDonationStatus"("weekStart");
