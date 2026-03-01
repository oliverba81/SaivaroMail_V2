-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "SccUserRole" AS ENUM ('super_admin', 'admin', 'operator');

-- CreateEnum
CREATE TYPE "SccUserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('pending', 'provisioning', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('healthy', 'unhealthy', 'unknown');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_db_configs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dbHost" TEXT NOT NULL,
    "dbPort" INTEGER NOT NULL DEFAULT 5432,
    "dbName" TEXT NOT NULL,
    "dbUser" TEXT NOT NULL,
    "dbPassword" TEXT NOT NULL,
    "dbSslMode" TEXT NOT NULL DEFAULT 'prefer',
    "provisioningStatus" "ProvisioningStatus" NOT NULL DEFAULT 'pending',
    "provisionedAt" TIMESTAMP(3),
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_db_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scc_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "SccUserRole" NOT NULL DEFAULT 'admin',
    "status" "SccUserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scc_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_db_configs_companyId_key" ON "company_db_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "scc_users_email_key" ON "scc_users"("email");

-- AddForeignKey
ALTER TABLE "company_db_configs" ADD CONSTRAINT "company_db_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
