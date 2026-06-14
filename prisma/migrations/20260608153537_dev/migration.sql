/*
  Warnings:

  - You are about to drop the column `visit_id` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `visit_id` on the `vitals` table. All the data in the column will be lost.
  - Added the required column `bill_id` to the `visits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vital_id` to the `visits` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bills" DROP CONSTRAINT "bills_visit_id_fkey";

-- DropForeignKey
ALTER TABLE "vitals" DROP CONSTRAINT "vitals_visit_id_fkey";

-- DropIndex
DROP INDEX "bills_visit_id_key";

-- DropIndex
DROP INDEX "vitals_visit_id_key";

-- AlterTable
ALTER TABLE "bills" DROP COLUMN "visit_id";

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "bill_id" UUID NOT NULL,
ADD COLUMN     "vital_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "vitals" DROP COLUMN "visit_id";

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_vital_id_fkey" FOREIGN KEY ("vital_id") REFERENCES "vitals"("vital_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("bill_id") ON DELETE RESTRICT ON UPDATE CASCADE;
