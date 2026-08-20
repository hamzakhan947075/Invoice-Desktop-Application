-- AlterTable
ALTER TABLE "customers" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");

-- CreateIndex
CREATE INDEX "invoices_deletedAt_idx" ON "invoices"("deletedAt");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");
