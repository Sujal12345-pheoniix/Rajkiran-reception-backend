/*
  Warnings:

  - Added the required column `unique_id` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "unique_id" VARCHAR(20) NOT NULL;
