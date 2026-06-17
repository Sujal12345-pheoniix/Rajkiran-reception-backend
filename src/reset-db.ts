import prisma from "./db/prisma.js";

async function main() {
  console.log("Starting Database Cleanup & Production Reset...");

  console.log("Purging patient records, visits, vitals, bills, logs, and sample doctors...");
  
  await prisma.patientAllergy.deleteMany();
  await prisma.patientChronicCondition.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.vital.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.adminLog.deleteMany();
  await prisma.doctor.deleteMany();

  console.log("Database successfully cleaned and reset to production-ready state!");
}

main()
  .catch((e) => {
    console.error("Error resetting database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
