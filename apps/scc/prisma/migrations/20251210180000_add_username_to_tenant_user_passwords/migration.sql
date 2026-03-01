-- AlterTable
ALTER TABLE "tenant_user_passwords" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Update existing rows: set username from email if available
UPDATE "tenant_user_passwords" SET "username" = "email" WHERE "username" IS NULL AND "email" IS NOT NULL;





