import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer, stopServer, api } from "./setup.js";

describe("Health Check — /api/health", () => {
  beforeAll(() => startServer());
  afterAll(() => stopServer());

  it("GET /api/health — returns ok status", async () => {
    const res = await api("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });
});
