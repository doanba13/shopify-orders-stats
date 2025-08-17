/*
  Warnings:

  - A unique constraint covering the columns `[sku,country]` on the table `bases` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "bases_sku_country_key" ON "public"."bases"("sku", "country");
