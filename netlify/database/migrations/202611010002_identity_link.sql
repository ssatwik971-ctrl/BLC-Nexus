-- Phase 2: map existing BLC Nexus members to verified Netlify Identity users.
-- Apply only after reviewing the Phase 1 baseline and backing up the database.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "netlifyIdentityId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_netlifyIdentityId_key" ON "User"("netlifyIdentityId");
