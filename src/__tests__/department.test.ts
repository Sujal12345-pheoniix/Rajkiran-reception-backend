import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Department Routes — /api/department", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  const adminUser = { username: `deptadmin_${Date.now()}`, password: "AdminPass123!" };
  let adminCookies: Record<string, string> = {};
  let adminUserId = "";
  let recepCookies: Record<string, string> = {};
  let createdDeptId = "";

  beforeAll(async () => {
    // Register admin
    const adminReg = await api("POST", "/api/auth/register", { body: adminUser });
    adminCookies = parseCookies(adminReg.cookies);
    adminUserId = adminReg.body.user.id;

    // Register + login receptionist
    const recepUser = { username: `deptrecep_${Date.now()}`, password: "RecepPass123!" };
    const recepReg = await api("POST", "/api/auth/reception/register", {
      body: { ...recepUser, created_by: adminUserId },
    });
    expect(recepReg.status).toBe(200);
    const recepLogin = await api("POST", "/api/auth/reception/login", { body: recepUser });
    recepCookies = parseCookies(recepLogin.cookies);
  });

  // ── Create department ─────────────────────────────────────
  it("POST / — admin can create department", async () => {
    const res = await api("POST", "/api/department", {
      cookies: adminCookies,
      body: {
        name: `Test Dept ${Date.now()}`,
        status: "active",
        created_by: adminUserId,
        description: "Test department for API tests",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("department_id");
    expect(res.body.name).toMatch(/^Test Dept/);
    expect(res.body.status).toBe("active");
    createdDeptId = res.body.department_id;
  });

  it("POST / — rejects without admin role", async () => {
    const res = await api("POST", "/api/department", {
      cookies: recepCookies,
      body: {
        name: `Should Fail ${Date.now()}`,
        status: "active",
        created_by: adminUserId,
      },
    });
    expect(res.status).toBe(403);
  });

  it("POST / — rejects without auth", async () => {
    const res = await api("POST", "/api/department", {
      body: { name: "No Auth Dept", status: "active", created_by: adminUserId },
    });
    expect(res.status).toBe(401);
  });

  it("POST / — validates required name field", async () => {
    const res = await api("POST", "/api/department", {
      cookies: adminCookies,
      body: { status: "active", created_by: adminUserId },
    });
    expect(res.status).toBe(400);
  });

  // ── List departments ──────────────────────────────────────
  it("GET / — receptionist can list active departments", async () => {
    const res = await api("GET", "/api/department", {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should include the department we created
    const found = res.body.find((d: any) => d.department_id === createdDeptId);
    expect(found).toBeDefined();
    expect(found!.status).toBe("active");
  });

  it("GET / — rejects without auth", async () => {
    const res = await api("GET", "/api/department");
    expect(res.status).toBe(401);
  });

  // ── Get single department ─────────────────────────────────
  it("GET /:id — returns department by ID", async () => {
    const res = await api("GET", `/api/department/${createdDeptId}`, {
      cookies: recepCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.department_id).toBe(createdDeptId);
  });

  it("GET /:id — returns 404 for non-existent ID", async () => {
    const res = await api("GET", "/api/department/00000000-0000-0000-0000-000000000000", {
      cookies: recepCookies,
    });
    expect(res.status).toBe(404);
  });

  // ── Deactivate ────────────────────────────────────────────
  it("POST /:id — admin can deactivate department", async () => {
    const res = await api("POST", `/api/department/${createdDeptId}`, {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.department_id).toBe(createdDeptId);
  });
});
