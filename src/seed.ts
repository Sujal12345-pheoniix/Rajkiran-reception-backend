import prisma from "../src/db/prisma.js";
import { hashPassword } from "../src/lib/password.js";

async function main() {
  console.log("Seeding database...");

  // 1. Create default admin if not exists
  const adminPassword = await hashPassword("password123");
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword,
      role: "admin",
    },
  });
  console.log("Admin user set: admin / password123");

  // 2. Create default receptionist if not exists
  const receptionPassword = await hashPassword("password123");
  const receptionist = await prisma.user.upsert({
    where: { username: "reception" },
    update: {},
    create: {
      username: "reception",
      password: receptionPassword,
      role: "receptionist",
      created_by: admin.user_id,
    },
  });
  console.log("Receptionist user set: reception / password123");

  // 3. Create default departments
  const peds = await prisma.department.upsert({
    where: { name: "Pediatrics" },
    update: {},
    create: {
      name: "Pediatrics",
      description: "Care of infants, children, and adolescents",
      status: "active",
      created_by: admin.user_id,
    },
  });

  const card = await prisma.department.upsert({
    where: { name: "Cardiology" },
    update: {},
    create: {
      name: "Cardiology",
      description: "Heart and circulatory health care",
      status: "active",
      created_by: admin.user_id,
    },
  });
  console.log("Departments created: Pediatrics, Cardiology");

  // 4. Create default doctors
  const doc1 = await prisma.doctor.upsert({
    where: { email: "dr.sharma@hospital.com" },
    update: {},
    create: {
      first_name: "Aarav",
      last_name: "Sharma",
      specialization: "Pediatrician",
      qualification: "MD Pediatrics",
      mobile: "9876543210",
      email: "dr.sharma@hospital.com",
      consultation_fee: 500,
      status: "active",
      department_id: peds.department_id,
      created_by: admin.user_id,
    },
  });

  const doc2 = await prisma.doctor.upsert({
    where: { email: "dr.verma@hospital.com" },
    update: {},
    create: {
      first_name: "Vikram",
      last_name: "Verma",
      specialization: "Cardiologist",
      qualification: "DM Cardiology",
      mobile: "9876543211",
      email: "dr.verma@hospital.com",
      consultation_fee: 800,
      status: "active",
      department_id: card.department_id,
      created_by: admin.user_id,
    },
  });
  console.log("Doctors created: Dr. Aarav Sharma, Dr. Vikram Verma");
  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
