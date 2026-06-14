/*
  Warnings:

  - Made the column `specialization` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `department_id` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `qualification` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mobile` on table `doctors` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `doctors` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_department_id_fkey";

-- AlterTable
ALTER TABLE "doctors" ALTER COLUMN "specialization" SET NOT NULL,
ALTER COLUMN "department_id" SET NOT NULL,
ALTER COLUMN "qualification" SET NOT NULL,
ALTER COLUMN "mobile" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;
