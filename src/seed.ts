import prisma from "./db/prisma.js";
import { hashPassword } from "./lib/password.js";

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

  // 3. Create 15 standard departments
  const departmentNames = [
    { name: "General Medicine", desc: "General health, diagnoses, and primary care" },
    { name: "Cardiology", desc: "Heart and circulatory health care" },
    { name: "Neurology", desc: "Brain, spinal cord, and nervous system disorders" },
    { name: "Orthopedics", desc: "Bones, joints, ligaments, tendons, and muscles" },
    { name: "ENT", desc: "Ear, Nose, and Throat specialties" },
    { name: "Dermatology", desc: "Skin, hair, and nail health and diseases" },
    { name: "Pediatrics", desc: "Care of infants, children, and adolescents" },
    { name: "Psychiatry", desc: "Mental health and behavioral disorders" },
    { name: "Urology", desc: "Urinary tract and male reproductive system" },
    { name: "Oncology", desc: "Cancer diagnosis, treatment, and care" },
    { name: "Pulmonology", desc: "Respiratory system and lung conditions" },
    { name: "Emergency", desc: "Immediate acute care and trauma response" },
    { name: "Radiology", desc: "Imaging diagnostics (X-ray, MRI, CT)" },
    { name: "Pathology", desc: "Laboratory diagnostics and tests" },
    { name: "Gynecology", desc: "Female reproductive health and pregnancy" },
  ];

  const deptMap: Record<string, string> = {};

  for (const dept of departmentNames) {
    const d = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.desc },
      create: {
        name: dept.name,
        description: dept.desc,
        status: "active",
        created_by: admin.user_id,
      },
    });
    deptMap[dept.name] = d.department_id;
  }
  console.log("All 15 departments seeded.");

  // 4. Create default doctors
  const doctorsData = [
    {
      first_name: "Aarav",
      last_name: "Sharma",
      specialization: "General Physician",
      qualification: "MD General Medicine",
      mobile: "9876543210",
      email: "dr.sharma@hospital.com",
      fee: 500,
      dept: "General Medicine",
    },
    {
      first_name: "Vikram",
      last_name: "Verma",
      specialization: "Cardiologist",
      qualification: "DM Cardiology",
      mobile: "9876543211",
      email: "dr.verma@hospital.com",
      fee: 800,
      dept: "Cardiology",
    },
    {
      first_name: "Ananya",
      last_name: "Rao",
      specialization: "Neurologist",
      qualification: "DM Neurology",
      mobile: "9876543212",
      email: "dr.rao@hospital.com",
      fee: 1000,
      dept: "Neurology",
    },
    {
      first_name: "Siddharth",
      last_name: "Patel",
      specialization: "Orthopedician",
      qualification: "MS Orthopedics",
      mobile: "9876543213",
      email: "dr.patel@hospital.com",
      fee: 700,
      dept: "Orthopedics",
    },
    {
      first_name: "Pooja",
      last_name: "Reddy",
      specialization: "Gynecologist",
      qualification: "MS OBGYN",
      mobile: "9876543214",
      email: "dr.reddy@hospital.com",
      fee: 650,
      dept: "Gynecology",
    },
  ];

  const docMap: Record<string, string> = {};

  for (const doc of doctorsData) {
    const d = await prisma.doctor.upsert({
      where: { email: doc.email },
      update: { status: "active", consultation_fee: doc.fee },
      create: {
        first_name: doc.first_name,
        last_name: doc.last_name,
        specialization: doc.specialization,
        qualification: doc.qualification,
        mobile: doc.mobile,
        email: doc.email,
        consultation_fee: doc.fee,
        status: "active",
        department_id: deptMap[doc.dept],
        created_by: admin.user_id,
      },
    });
    docMap[`${doc.first_name} ${doc.last_name}`] = d.doctor_id;
  }
  console.log("Sample doctors seeded.");

  // 5. Seed standard allergies and chronic conditions if empty
  const standardAllergies = [
    { name: "Penicillin", category: "drug" },
    { name: "Sulfonamides", category: "drug" },
    { name: "Peanuts", category: "food" },
    { name: "Shellfish", category: "food" },
    { name: "Latex", category: "other" },
  ];

  for (const allergy of standardAllergies) {
    await prisma.allergy.upsert({
      where: { allergy_name: allergy.name },
      update: {},
      create: {
        allergy_name: allergy.name,
        category: allergy.category,
      },
    });
  }

  const standardConditions = [
    "Diabetes",
    "Hypertension",
    "Asthma",
    "Cancer",
    "Heart Disease",
    "Kidney Disease",
    "Thyroid",
    "Tuberculosis",
  ];

  for (const cond of standardConditions) {
    await prisma.chronicCondition.upsert({
      where: { condition_name: cond },
      update: {},
      create: {
        condition_name: cond,
      },
    });
  }
  console.log("Allergies and chronic conditions seeded.");

  // 6. Seed mock patient "Sujal Kumar" with historical visits & vitals
  const existingPatient = await prisma.patient.findFirst({
    where: { mobile: "6207210784" },
  });

  let patientId = existingPatient?.patient_id;
  if (!existingPatient) {
    const p = await prisma.patient.create({
      data: {
        unique_id: "PT2606SJL",
        first_name: "Sujal",
        last_name: "Kumar",
        dob: new Date("1998-05-15"),
        gender: "Male",
        mobile: "6207210784",
        email: "sujal@example.com",
        address: "Patna, Bihar, India",
        created_by: receptionist.user_id,
      },
    });
    patientId = p.patient_id;
    console.log("Patient Sujal Kumar created.");
  }

  // Clear existing visits for Sujal Kumar if we want fresh mock trend data
  if (patientId) {
    const patientVisitsCount = await prisma.visit.count({
      where: { patient_id: patientId },
    });

    if (patientVisitsCount === 0) {
      console.log("Seeding visits history for Sujal Kumar...");
      // Let's create 3 historical visits over the past 3 months
      const historicalDates = [
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      ];

      // Add a couple of allergies and chronic conditions
      const penicillinAllergy = await prisma.allergy.findUnique({
        where: { allergy_name: "Penicillin" },
      });
      const diabetesCondition = await prisma.chronicCondition.findUnique({
        where: { condition_name: "Diabetes" },
      });

      if (penicillinAllergy) {
        await prisma.patientAllergy.upsert({
          where: {
            patient_id_allergy_id: {
              patient_id: patientId,
              allergy_id: penicillinAllergy.allergy_id,
            },
          },
          update: {},
          create: {
            patient_id: patientId,
            allergy_id: penicillinAllergy.allergy_id,
            specific_note: "Anaphylaxis skin rash",
          },
        });
      }

      if (diabetesCondition) {
        await prisma.patientChronicCondition.upsert({
          where: {
            patient_id_condition_id: {
              patient_id: patientId,
              condition_id: diabetesCondition.condition_id,
            },
          },
          update: {},
          create: {
            patient_id: patientId,
            condition_id: diabetesCondition.condition_id,
            other_specific_note: "Type-2 diabetes diagnosed in 2024",
          },
        });
      }

      // Visit 1: 90 days ago
      let v1Vital = await prisma.vital.create({
        data: {
          blood_pressure: "130/85",
          heart_rate: 78,
          temperature: 98.6,
          weight: 75,
          height: 175,
          bmi: 24.49,
          oxygen_saturation: 98,
          respiratory_rate: 16,
          blood_sugar: 110,
          pain_scale: 1,
          recorded_at: historicalDates[0],
        },
      });
      let v1Bill = await prisma.bill.create({
        data: {
          consultation_fee: 500,
          extra_charges: 100,
          total_amount: 600,
          registration_fee: 100,
          tests_fee: 0,
          medicines_fee: 0,
          tax: 0,
          discount: 0,
          grand_total: 600,
          payment_status: "paid",
          payment_method: "cash",
          created_by: receptionist.user_id,
          bill_date: historicalDates[0],
        },
      });
      await prisma.visit.create({
        data: {
          visit_id: "00000000-0000-0000-0000-000000000001",
          patient_id: patientId,
          doctor_id: docMap["Aarav Sharma"],
          vital_id: v1Vital.vital_id,
          bill_id: v1Bill.bill_id,
          consultation_fee: 500,
          visit_type: "OPD",
          visit_date: historicalDates[0],
          symptoms: ["Cough", "Cold"],
          chief_complaint: "Mild cough and running nose for 3 days",
          visit_notes: "Prescribed Cetirizine and Cough syrup. Advised steam inhalation.",
          created_by: receptionist.user_id,
        },
      });

      // Visit 2: 45 days ago
      let v2Vital = await prisma.vital.create({
        data: {
          blood_pressure: "140/90",
          heart_rate: 82,
          temperature: 99.1,
          weight: 76,
          height: 175,
          bmi: 24.82,
          oxygen_saturation: 97,
          respiratory_rate: 18,
          blood_sugar: 145,
          pain_scale: 3,
          recorded_at: historicalDates[1],
        },
      });
      let v2Bill = await prisma.bill.create({
        data: {
          consultation_fee: 800,
          extra_charges: 350,
          total_amount: 1150,
          registration_fee: 0,
          tests_fee: 250,
          medicines_fee: 100,
          tax: 0,
          discount: 0,
          grand_total: 1150,
          payment_status: "paid",
          payment_method: "card",
          created_by: receptionist.user_id,
          bill_date: historicalDates[1],
        },
      });
      await prisma.visit.create({
        data: {
          visit_id: "00000000-0000-0000-0000-000000000002",
          patient_id: patientId,
          doctor_id: docMap["Vikram Verma"],
          vital_id: v2Vital.vital_id,
          bill_id: v2Bill.bill_id,
          consultation_fee: 800,
          visit_type: "OPD",
          visit_date: historicalDates[1],
          symptoms: ["Chest Pain", "Dizziness"],
          chief_complaint: "Occasional chest tightness and palpitations, especially post exertion",
          visit_notes: "ECG done, showed normal sinus rhythm. Suggested Lipid profile test and HbA1c.",
          created_by: receptionist.user_id,
        },
      });

      // Visit 3: 10 days ago
      let v3Vital = await prisma.vital.create({
        data: {
          blood_pressure: "128/80",
          heart_rate: 72,
          temperature: 98.4,
          weight: 74.5,
          height: 175,
          bmi: 24.33,
          oxygen_saturation: 99,
          respiratory_rate: 14,
          blood_sugar: 115,
          pain_scale: 0,
          recorded_at: historicalDates[2],
        },
      });
      let v3Bill = await prisma.bill.create({
        data: {
          consultation_fee: 800,
          extra_charges: 200,
          total_amount: 1000,
          registration_fee: 0,
          tests_fee: 0,
          medicines_fee: 200,
          tax: 0,
          discount: 0,
          grand_total: 1000,
          payment_status: "paid",
          payment_method: "upi",
          created_by: receptionist.user_id,
          bill_date: historicalDates[2],
        },
      });
      await prisma.visit.create({
        data: {
          visit_id: "00000000-0000-0000-0000-000000000003",
          patient_id: patientId,
          doctor_id: docMap["Vikram Verma"],
          vital_id: v3Vital.vital_id,
          bill_id: v3Bill.bill_id,
          consultation_fee: 800,
          visit_type: "OPD",
          visit_date: historicalDates[2],
          symptoms: ["Weakness"],
          chief_complaint: "Follow-up visit for hypertension and diabetes check. Feeling much better.",
          visit_notes: "BP controlled. Continue Metformin 500mg and Amlodipine 5mg. Advised low salt diet.",
          created_by: receptionist.user_id,
        },
      });

      console.log("Historical visits seeded successfully.");
    }
  }

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
