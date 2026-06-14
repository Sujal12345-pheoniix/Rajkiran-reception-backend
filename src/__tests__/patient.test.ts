import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Patient Routes — /api/patient", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  let adminCookies: Record<string, string> = {};
  let recepCookies: Record<string, string> = {};
  let adminUserId = "";
  let originalMobile = "";

  beforeAll(async () => {
    // Register + login admin
    const adminUser = { username: `patadmin_${Date.now()}`, password: "AdminPass123!" };
    const adminReg = await api("POST", "/api/auth/register", { body: adminUser });
    adminCookies = parseCookies(adminReg.cookies);
    adminUserId = adminReg.body.user.id;

    // Register + login receptionist
    const recepUser = { username: `patrecep_${Date.now()}`, password: "RecepPass123!" };
    const recepReg = await api("POST", "/api/auth/reception/register", {
      body: { ...recepUser, created_by: adminUserId },
    });
    expect(recepReg.status).toBe(200);
    const recepLogin = await api("POST", "/api/auth/reception/login", { body: recepUser });
    recepCookies = parseCookies(recepLogin.cookies);
  });

  // ── Create patient ───────────────────────────────────────
  it("POST / — receptionist can create a patient", async () => {
    originalMobile = `98${Date.now().toString().slice(-8)}`;
    const res = await api("POST", "/api/patient", {
      cookies: recepCookies,
      body: {
        first_name: "Jane",
        last_name: "Smith",
        dob: new Date("1990-05-15").toISOString(),
        gender: "female",
        mobile: originalMobile,
        email: `jane.smith.${Date.now()}@test.com`,
        address: "123 Test St",
        created_by: adminUserId,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("patient_id");
    expect(res.body.first_name).toBe("Jane");
    expect(res.body.last_name).toBe("Smith");
  });

  it("POST / — rejects duplicate mobile", async () => {
    expect(originalMobile).toBeTruthy();
    const res = await api("POST", "/api/patient", {
      cookies: recepCookies,
      body: {
        first_name: "John",
        last_name: "Doe",
        dob: new Date("1985-01-01").toISOString(),
        gender: "male",
        mobile: originalMobile,
        created_by: adminUserId,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("POST / — rejects without receptionist role", async () => {
    const res = await api("POST", "/api/patient", {
      cookies: adminCookies,
      body: {
        first_name: "Bad",
        last_name: "Role",
        dob: new Date("2000-01-01").toISOString(),
        gender: "other",
        mobile: `11${Date.now().toString().slice(-8)}`,
        created_by: adminUserId,
      },
    });
    expect(res.status).toBe(403);
  });

  it("POST / — rejects without auth", async () => {
    const res = await api("POST", "/api/patient", {
      body: {
        first_name: "No",
        last_name: "Auth",
        dob: new Date("2000-01-01").toISOString(),
        gender: "other",
        mobile: `22${Date.now().toString().slice(-8)}`,
        created_by: adminUserId,
      },
    });
    expect(res.status).toBe(401);
  });

  it("POST / — validates required fields", async () => {
    const res = await api("POST", "/api/patient", {
      cookies: recepCookies,
      body: { first_name: "Missing", last_name: "Fields" },
    });
    expect(res.status).toBe(400);
  });

  // ── List patients ────────────────────────────────────────
  it("GET /:limit/:page — receptionist can list patients with pagination", async () => {
    const res = await api("GET", "/api/patient/10/1?limit=10&page=0", {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /:limit/:page — respects limit query param", async () => {
    const res = await api("GET", "/api/patient/5/1?limit=5&page=0", {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

  it("GET /:limit/:page — rejects without auth", async () => {
    const res = await api("GET", "/api/patient/10/1");
    expect(res.status).toBe(401);
  });
});
