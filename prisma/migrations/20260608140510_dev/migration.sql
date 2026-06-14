/*
  Warnings:

  - Added the required column `created_by` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "created_by" UUID NOT NULL;
