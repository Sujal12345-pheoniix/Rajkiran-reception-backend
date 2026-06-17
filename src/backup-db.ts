import prisma from "./db/prisma.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting Database Backup...");

  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const [patients, visits, vitals, bills, logs, doctors, allergies, chronicConditions] = await Promise.all([
    prisma.patient.findMany(),
    prisma.visit.findMany(),
    prisma.vital.findMany(),
    prisma.bill.findMany(),
    prisma.adminLog.findMany(),
    prisma.doctor.findMany(),
    prisma.allergy.findMany(),
    prisma.chronicCondition.findMany(),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

  const backupData = {
    patients,
    visits,
    vitals,
    bills,
    logs,
    doctors,
    allergies,
    chronicConditions,
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log(`Database backup saved successfully to ${backupPath}`);
}

main()
  .catch((e) => {
    console.error("Error backing up database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
