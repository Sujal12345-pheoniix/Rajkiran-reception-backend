// Load dotenv before any app imports
import "dotenv/config";

import { createServer } from "node:http";
import type { Server } from "node:http";
import app from "../app.js";

let server: Server | null = null;
const TEST_PORT = parseInt(process.env.PORT ?? "3099", 10);
const base = `http://localhost:${TEST_PORT}`;

export function getBase(): string {
  return base;
}

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer(app).listen(TEST_PORT, resolve);
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

export interface ApiOptions {
  body?: unknown;
  token?: string;
  cookies?: Record<string, string>;
}

export async function api(
  method: string,
  path: string,
  options?: ApiOptions,
): Promise<{ status: number; body: any; cookies: string[] }> {
  const headers: Record<string, string> = {};

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  if (options?.cookies) {
    headers["Cookie"] = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  let body: any;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, cookies: setCookie };
}

export function parseCookies(setCookie: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of setCookie) {
    const [kv] = c.split(";");
    if (!kv) continue;
    const [k, ...v] = kv.split("=");
    if (k) map[k.trim()] = v.join("=");
  }
  return map;
}
