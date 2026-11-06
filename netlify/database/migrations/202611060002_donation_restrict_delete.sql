-- A member with donations can no longer be deleted (it would silently change the coop balance).
-- Runs only if the Donation table already exists; a baseline generated from the current schema already has this.
DO $$
BEGIN
  IF to_regclass('"Donation"') IS NOT NULL THEN
    ALTER TABLE "Donation" DROP CONSTRAINT IF EXISTS "Donation_userId_fkey";
    ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
