-- CreateEnum
CREATE TYPE "CronJobType" AS ENUM ('scheduled_trigger', 'email_fetch');

-- CreateEnum
CREATE TYPE "CronJobStatus" AS ENUM ('running', 'success', 'failed');

-- CreateTable
CREATE TABLE "cron_job_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_type" "CronJobType" NOT NULL,
    "job_key" TEXT NOT NULL,
    "status" "CronJobStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "execution_time_ms" INTEGER,
    "processed_items" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cron_job_logs_company_id_job_key_started_at_key" ON "cron_job_logs"("company_id", "job_key", "started_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_company_id_created_at_idx" ON "cron_job_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_company_id_job_type_status_idx" ON "cron_job_logs"("company_id", "job_type", "status");

-- CreateIndex
CREATE INDEX "cron_job_logs_company_id_started_at_idx" ON "cron_job_logs"("company_id", "started_at");

-- CreateIndex
CREATE INDEX "cron_job_logs_job_key_idx" ON "cron_job_logs"("job_key");

-- AddForeignKey
ALTER TABLE "cron_job_logs" ADD CONSTRAINT "cron_job_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;



