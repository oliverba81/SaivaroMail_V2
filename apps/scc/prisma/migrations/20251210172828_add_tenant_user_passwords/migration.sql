-- CreateTable
CREATE TABLE "tenant_user_passwords" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tenant_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_user_passwords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_user_passwords_company_id_idx" ON "tenant_user_passwords"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_passwords_company_id_tenant_user_id_key" ON "tenant_user_passwords"("company_id", "tenant_user_id");

-- AddForeignKey
ALTER TABLE "tenant_user_passwords" ADD CONSTRAINT "tenant_user_passwords_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
