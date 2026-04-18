-- AlterEnum
ALTER TYPE "public"."InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RETURNED';
ALTER TYPE "public"."InvoiceStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."PaymentMethod_new" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER');
ALTER TABLE "public"."Payment" ALTER COLUMN "method" TYPE "public"."PaymentMethod_new" USING ("method"::text::"public"."PaymentMethod_new");
ALTER TYPE "public"."PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "public"."PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."ReturnStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- DropForeignKey
ALTER TABLE "public"."CustomerContact" DROP CONSTRAINT IF EXISTS "CustomerContact_customerId_fkey";
ALTER TABLE "public"."Receivable" DROP CONSTRAINT IF EXISTS "Receivable_customerId_fkey";
ALTER TABLE "public"."Receivable" DROP CONSTRAINT IF EXISTS "Receivable_invoiceId_fkey";
ALTER TABLE "public"."Reservation" DROP CONSTRAINT IF EXISTS "Reservation_batchId_fkey";
ALTER TABLE "public"."Reservation" DROP CONSTRAINT IF EXISTS "Reservation_customerId_fkey";
ALTER TABLE "public"."Reservation" DROP CONSTRAINT IF EXISTS "Reservation_productId_fkey";
ALTER TABLE "public"."Reservation" DROP CONSTRAINT IF EXISTS "Reservation_warehouseId_fkey";
ALTER TABLE "public"."SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_createdById_fkey";
ALTER TABLE "public"."SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_customerId_fkey";
ALTER TABLE "public"."SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_warehouseId_fkey";
ALTER TABLE "public"."SalesOrderItem" DROP CONSTRAINT IF EXISTS "SalesOrderItem_productId_fkey";
ALTER TABLE "public"."SalesOrderItem" DROP CONSTRAINT IF EXISTS "SalesOrderItem_salesOrderId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "public"."Invoice_customerId_createdAt_idx";
DROP INDEX IF EXISTS "public"."Payment_customerId_paymentDate_idx";
DROP INDEX IF EXISTS "public"."Receivable_customerId_dueDate_idx";
DROP INDEX IF EXISTS "public"."Receivable_customerId_status_idx";
DROP INDEX IF EXISTS "public"."Receivable_status_dueDate_idx";
DROP INDEX IF EXISTS "public"."Reservation_warehouseId_productId_status_idx";

-- AlterTable
ALTER TABLE "public"."Receivable"
  ADD COLUMN IF NOT EXISTS "customerName" TEXT,
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "public"."Reservation"
  DROP COLUMN IF EXISTS "customerId",
  DROP COLUMN IF EXISTS "productId",
  DROP COLUMN IF EXISTS "reason",
  DROP COLUMN IF EXISTS "warehouseId",
  ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3),
  ALTER COLUMN "batchId" SET NOT NULL,
  DROP COLUMN IF EXISTS "status",
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "public"."ReturnItem" ADD COLUMN IF NOT EXISTS "invoiceItemId" TEXT;

-- DropTable
DROP TABLE IF EXISTS "public"."CustomerContact";
DROP TABLE IF EXISTS "public"."CustomerReceivable";
DROP TABLE IF EXISTS "public"."SalesOrder";
DROP TABLE IF EXISTS "public"."SalesOrderItem";

-- DropEnum
DROP TYPE IF EXISTS "public"."ReservationStatus";
DROP TYPE IF EXISTS "public"."SalesOrderStatus";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_code_idx" ON "public"."Customer"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_invoiceId_key" ON "public"."Receivable"("invoiceId");
CREATE INDEX IF NOT EXISTS "Receivable_customerName_status_idx" ON "public"."Receivable"("customerName", "status");
CREATE INDEX IF NOT EXISTS "Receivable_customerId_idx" ON "public"."Receivable"("customerId");
CREATE INDEX IF NOT EXISTS "Reservation_batchId_idx" ON "public"."Reservation"("batchId");

-- AddForeignKey
ALTER TABLE "public"."Receivable" ADD CONSTRAINT "Receivable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Receivable" ADD CONSTRAINT "Receivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
