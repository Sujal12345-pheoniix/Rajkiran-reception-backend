/*
  Warnings:

  - You are about to drop the column `department_id` on the `visits` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "visits" DROP CONSTRAINT "visits_department_id_fkey";

-- AlterTable
ALTER TABLE "visits" DROP COLUMN "department_id";
