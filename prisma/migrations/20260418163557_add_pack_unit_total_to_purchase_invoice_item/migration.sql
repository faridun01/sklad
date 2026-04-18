/*
  Warnings:

  - You are about to drop the column `expiryDate` on the `PurchaseInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `purchasePrice` on the `PurchaseInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `retailPrice` on the `PurchaseInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `wholesalePrice` on the `PurchaseInvoiceItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."PurchaseInvoiceItem" DROP COLUMN "expiryDate",
DROP COLUMN "purchasePrice",
DROP COLUMN "retailPrice",
DROP COLUMN "wholesalePrice",
ADD COLUMN     "packPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
