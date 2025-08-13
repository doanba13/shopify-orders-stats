/*
  Warnings:

  - You are about to drop the column `product_variant_id` on the `bases` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."bases" DROP CONSTRAINT "bases_product_variant_id_fkey";

-- AlterTable
ALTER TABLE "public"."bases" DROP COLUMN "product_variant_id";
