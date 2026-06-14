import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api, parseCookies } from "./setup.js";

describe("Auth Routes — /api/auth", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  const testAdmin = {
    username: `testadmin_${Date.now()}`,
    password: "testPass123!",
  };
  const testRecep = {
    username: `testrecep_${Date.now()}`,
    password: "password123",
  };
  let adminToken = "";
  let adminCookies: Record<string, string> = {};
  let adminUserId = "";
  let recepCookies: Record<string, string> = {};

  // ── Register ──────────────────────────────────────────────
  it("POST /register — creates admin user and returns cookies", async () => {
    const res = await api("POST", "/api/auth/register", {
      body: testAdmin,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.username).toBe(testAdmin.username);
    expect(res.cookies.length).toBeGreaterThanOrEqual(2);
    adminUserId = res.body.user.id;

    adminCookies = parseCookies(res.cookies);
    expect(adminCookies).toHaveProperty("access_token");
    expect(adminCookies).toHaveProperty("refresh_token");
    adminToken = adminCookies["access_token"] ?? "";
  });

  it("POST /register — rejects duplicate username", async () => {
    const res = await api("POST", "/api/auth/register", {
      body: testAdmin,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("POST /register — validates required fields", async () => {
    const res = await api("POST", "/api/auth/register", { body: {} });
    expect(res.status).toBe(400);
  });

  // ── Login ─────────────────────────────────────────────────
  it("POST /login — authenticates and sets cookies", async () => {
    const res = await api("POST", "/api/auth/login", {
      body: { username: testAdmin.username, password: testAdmin.password },
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.role).toBe("admin");
    expect(res.cookies.length).toBeGreaterThanOrEqual(2);

    adminCookies = parseCookies(res.cookies);
    adminToken = adminCookies["access_token"] ?? "";

    // Verify cookies are httpOnly
    const accessCookie = res.cookies.find((c) => c.startsWith("access_token="));
    expect(accessCookie).toBeDefined();
    expect(accessCookie!.toLowerCase()).toContain("httponly");
  });

  it("POST /login — rejects wrong password", async () => {
    const res = await api("POST", "/api/auth/login", {
      body: { username: testAdmin.username, password: "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /login — rejects non-existent user", async () => {
    const res = await api("POST", "/api/auth/login", {
      body: { username: "nobody", password: "whatever" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /login — validates empty body", async () => {
    const res = await api("POST", "/api/auth/login", { body: {} });
    expect(res.status).toBe(400);
  });

  // ── Reception endpoints ───────────────────────────────────
  it("POST /reception/register — creates receptionist user (with real admin id)", async () => {
    expect(adminUserId).toBeTruthy();
    const res = await api("POST", "/api/auth/reception/register", {
      body: { ...testRecep, created_by: adminUserId },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("receptionist");
    recepCookies = parseCookies(res.cookies);
  });

  it("POST /reception/login — authenticates receptionist", async () => {
    const res = await api("POST", "/api/auth/reception/login", {
      body: { username: testRecep.username, password: testRecep.password },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("receptionist");
    recepCookies = parseCookies(res.cookies);
  });

  it("POST /reception/login — rejects admin user", async () => {
    const res = await api("POST", "/api/auth/reception/login", {
      body: { username: testAdmin.username, password: testAdmin.password },
    });
    expect(res.status).toBe(401);
  });

  // ── GET /me ───────────────────────────────────────────────
  it("GET /me — returns profile with valid cookie", async () => {
    const res = await api("GET", "/api/auth/me", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(testAdmin.username);
    expect(res.body.data.role).toBe("admin");
  });

  it("GET /me — returns profile with Bearer token", async () => {
    const res = await api("GET", "/api/auth/me", {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(testAdmin.username);
  });

  it("GET /me — rejects without auth", async () => {
    const res = await api("GET", "/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /me — rejects with invalid token", async () => {
    const res = await api("GET", "/api/auth/me", {
      token: "invalid-token",
    });
    expect(res.status).toBe(401);
  });

  // ── Refresh ───────────────────────────────────────────────
  it("POST /refresh — rotates tokens with valid cookie", async () => {
    const res = await api("POST", "/api/auth/refresh", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.cookies.length).toBeGreaterThanOrEqual(2);

    const newCookies = parseCookies(res.cookies);
    expect(newCookies["access_token"]).toBeDefined();
    expect(newCookies["refresh_token"]).toBeDefined();

    // Token should have rotated
    expect(newCookies["access_token"]).not.toBe(adminCookies["access_token"]);
    expect(newCookies["refresh_token"]).not.toBe(adminCookies["refresh_token"]);

    adminCookies = newCookies;
  });

  it("POST /refresh — rejects without cookie", async () => {
    const res = await api("POST", "/api/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  // ── Logout ────────────────────────────────────────────────
  it("POST /logout — clears cookies", async () => {
    const res = await api("POST", "/api/auth/logout", {
      cookies: adminCookies,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // ClearCookie sets either max-age=0 or expires=<past date>
    const accessClear = res.cookies.find((c) => c.startsWith("access_token="));
    expect(accessClear).toBeDefined();
    // Bun's Set-Cookie uses expires=...1970 format; Express sets both max-age and expires
    const lower = accessClear!.toLowerCase();
    const hasMaxAge0 = lower.includes("max-age=0");
    const hasExpired =
      lower.includes("expires=thu, 01 jan 1970") ||
      lower.includes("expires=thu, 01 jan 1970");
    expect(hasMaxAge0 || hasExpired).toBe(true);
  });
});
