/*
  Warnings:

  - Added the required column `discount` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revenue_usd` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shipped` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sub_total` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tax` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "revenue_usd" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "shipped" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "sub_total" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "tax" DECIMAL(10,2) NOT NULL;
