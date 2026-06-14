import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Visit Routes — /api/visit", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  let adminCookies: Record<string, string> = {};
  let recepCookies: Record<string, string> = {};
  let adminUserId = "";
  let deptId = "";
  let doctorId = "";
  let patientId = "";

  beforeAll(async () => {
    // Register + login admin
    const adminUser = { username: `visadmin_${Date.now()}`, password: "AdminPass123!" };
    const adminReg = await api("POST", "/api/auth/register", { body: adminUser });
    adminCookies = parseCookies(adminReg.cookies);
    adminUserId = adminReg.body.user.id;

    // Register + login receptionist
    const recepUser = { username: `visrecep_${Date.now()}`, password: "RecepPass123!" };
    const recepReg = await api("POST", "/api/auth/reception/register", {
      body: { ...recepUser, created_by: adminUserId },
    });
    expect(recepReg.status).toBe(200);
    const recepLogin = await api("POST", "/api/auth/reception/login", { body: recepUser });
    recepCookies = parseCookies(recepLogin.cookies);

    // Create department
    const deptRes = await api("POST", "/api/department", {
      cookies: adminCookies,
      body: {
        name: `VisitTest Dept ${Date.now()}`,
        status: "active",
        created_by: adminUserId,
      },
    });
    deptId = deptRes.body.department_id;

    // Create doctor
    const docRes = await api("POST", "/api/doctor", {
      cookies: adminCookies,
      body: {
        first_name: "Visit",
        last_name: "Doctor",
        email: `visit.doc.${Date.now()}@test.com`,
        mobile: "+1234567890",
        specialization: "General Medicine",
        qualification: "MBBS, MD",
        consultation_fee: 500,
        department_id: deptId,
      },
    });
    doctorId = docRes.body.doctor_id;

    // Create patient
    const patRes = await api("POST", "/api/patient", {
      cookies: recepCookies,
      body: {
        first_name: "Visit",
        last_name: "Patient",
        dob: new Date("1990-05-15").toISOString(),
        gender: "male",
        mobile: `98${Date.now().toString().slice(-8)}`,
        created_by: adminUserId,
      },
    });
    patientId = patRes.body.patient_id;
  });

  // ── Create visit ─────────────────────────────────────────
  it("POST / — receptionist can create a visit", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: recepCookies,
      body: {
        patientId,
        doctorId,
        visit_type: "OPD",
        blood_pressure: "120/80",
        heart_rate: 72,
        temperature: 98.6,
        weight: 70,
        height: 175,
        payment_status: "paid",
        payment_method: "cash",
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Visit created successfully");
  });

  it("POST / — creates visit with minimal fields", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: recepCookies,
      body: {
        patientId,
        doctorId,
        visit_type: "Emergency",
        payment_method: "card",
      },
    });
    expect(res.status).toBe(201);
  });

  it("POST / — rejects non-existent patient", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: recepCookies,
      body: {
        patientId: "00000000-0000-0000-0000-000000000000",
        doctorId,
        visit_type: "OPD",
      },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/patient/i);
  });

  it("POST / — rejects non-existent doctor", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: recepCookies,
      body: {
        patientId,
        doctorId: "00000000-0000-0000-0000-000000000000",
        visit_type: "OPD",
      },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/doctor/i);
  });

  it("POST / — rejects without receptionist role", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: adminCookies,
      body: {
        patientId,
        doctorId,
        visit_type: "OPD",
      },
    });
    expect(res.status).toBe(403);
  });

  it("POST / — rejects without auth", async () => {
    const res = await api("POST", "/api/visit", {
      body: {
        patientId,
        doctorId,
        visit_type: "OPD",
      },
    });
    expect(res.status).toBe(401);
  });

  it("POST / — validates required fields", async () => {
    const res = await api("POST", "/api/visit", {
      cookies: recepCookies,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  // ── List visits ──────────────────────────────────────────
  it("GET / — receptionist can list all visits", async () => {
    const res = await api("GET", "/api/visit", {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    // Should include related vitals and bill
    const visit = res.body[0];
    expect(visit).toHaveProperty("vitals");
    expect(visit).toHaveProperty("bill");
  });

  it("GET / — rejects without auth", async () => {
    const res = await api("GET", "/api/visit");
    expect(res.status).toBe(401);
  });
});
