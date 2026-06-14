import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Users Routes — /api/users", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  let adminCookies: Record<string, string> = {};
  let adminUserId = "";
  let createdUserId = "";

  beforeAll(async () => {
    const adminUser = { username: `useradmin_${Date.now()}`, password: "AdminPass123!" };
    const adminReg = await api("POST", "/api/auth/register", { body: adminUser });
    adminCookies = parseCookies(adminReg.cookies);
    adminUserId = adminReg.body.user.id;
  });

  // ── Create user ──────────────────────────────────────────
  it("POST / — admin can create a receptionist user", async () => {
    const res = await api("POST", "/api/users", {
      cookies: adminCookies,
      body: {
        username: `newrecep_${Date.now()}`,
        password: "Str0ngPass!",
        role: "receptionist",
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("user_id");
    expect(res.body.data.username).toMatch(/^newrecep_/);
    expect(res.body.data.role).toBe("receptionist");
    createdUserId = res.body.data.user_id;
  });

  it("POST / — defaults to receptionist role", async () => {
    const res = await api("POST", "/api/users", {
      cookies: adminCookies,
      body: {
        username: `defaultrole_${Date.now()}`,
        password: "Str0ngPass!",
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("receptionist");
  });

  it("POST / — rejects without admin role", async () => {
    // Register a receptionist and try to use their cookies
    const recepUser = { username: `userrecep_${Date.now()}`, password: "RecepPass123!" };
    const regRes = await api("POST", "/api/auth/reception/register", {
      body: { ...recepUser, created_by: adminUserId },
    });
    expect(regRes.status).toBe(200);
    const loginRes = await api("POST", "/api/auth/reception/login", { body: recepUser });
    const recepCookies = parseCookies(loginRes.cookies);

    const res = await api("POST", "/api/users", {
      cookies: recepCookies,
      body: {
        username: "shouldfail",
        password: "Str0ngPass!",
      },
    });
    expect(res.status).toBe(403);
  });

  it("POST / — rejects without auth", async () => {
    const res = await api("POST", "/api/users", {
      body: { username: "noauth", password: "Str0ngPass!" },
    });
    expect(res.status).toBe(401);
  });

  it("POST / — validates required fields", async () => {
    const res = await api("POST", "/api/users", {
      cookies: adminCookies,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  // ── List users ───────────────────────────────────────────
  it("GET / — admin can list users with pagination", async () => {
    const res = await api("GET", "/api/users?page=1&limit=20", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("meta");
    expect(res.body.meta).toHaveProperty("total");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("GET / — validates pagination params", async () => {
    const res = await api("GET", "/api/users?page=0&limit=200", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(400);
  });

  it("GET / — rejects without auth", async () => {
    const res = await api("GET", "/api/users");
    expect(res.status).toBe(401);
  });

  // ── Get single user ──────────────────────────────────────
  it("GET /:id — admin can get a user by ID", async () => {
    const res = await api("GET", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user_id).toBe(createdUserId);
  });

  it("GET /:id — returns 404 for non-existent user", async () => {
    const res = await api(
      "GET",
      "/api/users/00000000-0000-0000-0000-000000000000",
      { cookies: adminCookies },
    );
    expect(res.status).toBe(404);
  });

  // ── Update user ──────────────────────────────────────────
  it("PATCH /:id — admin can deactivate a user", async () => {
    const res = await api("PATCH", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
      body: { is_active: false },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });

  it("PATCH /:id — admin can reactivate a user", async () => {
    const res = await api("PATCH", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
      body: { is_active: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });

  it("PATCH /:id — admin can change role", async () => {
    const res = await api("PATCH", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
      body: { role: "admin" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("admin");
  });

  it("PATCH /:id — rejects invalid role", async () => {
    const res = await api("PATCH", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
      body: { role: "superadmin" },
    });
    expect(res.status).toBe(400);
  });

  // ── Delete user ──────────────────────────────────────────
  it("DELETE /:id — admin can delete a user", async () => {
    const res = await api("DELETE", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
    });
    expect(res.status).toBe(204);
    expect(res.body).toBe("");

    // Verify user is gone
    const check = await api("GET", `/api/users/${createdUserId}`, {
      cookies: adminCookies,
    });
    expect(check.status).toBe(404);
  });

  it("DELETE /:id — validates ID param", async () => {
    const res = await api("DELETE", "/api/users/", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(404); // express won't match the route without the param
  });

  it("DELETE /:id — rejects without auth", async () => {
    const res = await api("DELETE", `/api/users/${createdUserId}`);
    expect(res.status).toBe(401);
  });
});
