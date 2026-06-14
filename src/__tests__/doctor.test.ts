import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Doctor Routes — /api/doctor", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  let adminCookies: Record<string, string> = {};
  let recepCookies: Record<string, string> = {};
  let deptId = "";
  let createdDoctorId = "";
  let adminUserId = "";
  let originalEmail = "";

  beforeAll(async () => {
    // Register + login admin
    const adminUser = { username: `docadmin_${Date.now()}`, password: "AdminPass123!" };
    const adminReg = await api("POST", "/api/auth/register", { body: adminUser });
    adminCookies = parseCookies(adminReg.cookies);
    adminUserId = adminReg.body.user.id;

    // Register + login receptionist (with real admin user_id)
    const recepUser = { username: `docrecep_${Date.now()}`, password: "RecepPass123!" };
    const recepReg = await api("POST", "/api/auth/reception/register", {
      body: { ...recepUser, created_by: adminUserId },
    });
    expect(recepReg.status).toBe(200);
    const recepLogin = await api("POST", "/api/auth/reception/login", { body: recepUser });
    recepCookies = parseCookies(recepLogin.cookies);

    // Create a department
    const deptRes = await api("POST", "/api/department", {
      cookies: adminCookies,
      body: {
        name: `DoctorTest Dept ${Date.now()}`,
        status: "active",
        created_by: adminUserId,
      },
    });
    deptId = deptRes.body.department_id;
  });

  // ── Create doctor ─────────────────────────────────────────
  it("POST / — admin can create a doctor", async () => {
    originalEmail = `dr.john.doe.${Date.now()}@test.com`;
    const res = await api("POST", "/api/doctor", {
      cookies: adminCookies,
      body: {
        first_name: "John",
        last_name: "Doe",
        email: originalEmail,
        mobile: "+1234567890",
        specialization: "Cardiology",
        qualification: "MBBS, MD",
        consultation_fee: 500,
        department_id: deptId,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("doctor_id");
    expect(res.body.first_name).toBe("John");
    expect(res.body.last_name).toBe("Doe");
    expect(res.body.status).toBe("active");
    createdDoctorId = res.body.doctor_id;
  });

  it("POST / — rejects duplicate email", async () => {
    expect(originalEmail).toBeTruthy();
    const res = await api("POST", "/api/doctor", {
      cookies: adminCookies,
      body: {
        first_name: "Jane",
        last_name: "Doe",
        email: originalEmail,
        mobile: "+1987654321",
        specialization: "Neurology",
        qualification: "MBBS, MD",
        consultation_fee: 600,
        department_id: deptId,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("POST / — rejects without admin role", async () => {
    const res = await api("POST", "/api/doctor", {
      cookies: recepCookies,
      body: {
        first_name: "Bad",
        last_name: "Doctor",
        email: `bad.doc.${Date.now()}@test.com`,
        mobile: "+1111111111",
        specialization: "General",
        qualification: "MBBS",
        consultation_fee: 300,
        department_id: deptId,
      },
    });
    expect(res.status).toBe(403);
  });

  it("POST / — rejects without auth", async () => {
    const res = await api("POST", "/api/doctor", {
      body: {
        first_name: "No",
        last_name: "Auth",
        email: `no.auth.${Date.now()}@test.com`,
        mobile: "+0000000000",
        specialization: "None",
        qualification: "None",
        consultation_fee: 0,
        department_id: deptId,
      },
    });
    expect(res.status).toBe(401);
  });

  // ── List doctors by department ────────────────────────────
  it("GET /:department_id — receptionist can list doctors in department", async () => {
    const res = await api("GET", `/api/doctor/${deptId}`, {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const found = res.body.find((d: any) => d.doctor_id === createdDoctorId);
    expect(found).toBeDefined();
    expect(found!.status).toBe("active");
  });

  it("GET /:department_id — returns empty array for non-existent dept", async () => {
    const res = await api(
      "GET",
      "/api/doctor/00000000-0000-0000-0000-000000000000",
      { cookies: recepCookies },
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("GET /:department_id — rejects without auth", async () => {
    const res = await api("GET", `/api/doctor/${deptId}`);
    expect(res.status).toBe(401);
  });
});
