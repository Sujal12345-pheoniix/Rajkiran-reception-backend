import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import type { CookieOptions } from "express";

function getSecret(name: string): Uint8Array {
  const s = process.env[name];
  if (!s) throw new Error(`${name} not set`);
  return new TextEncoder().encode(s);
}

const ACCESS_SECRET = () => getSecret("JWT_SECRET");
const REFRESH_SECRET = () => getSecret("JWT_REFRESH_SECRET");

export interface TokenPayload extends JWTPayload {
  sub: string; // user_id
  username: string;
  role: string;
}

export function signAccessToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10h")
    .sign(ACCESS_SECRET());
}

export function signRefreshToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(REFRESH_SECRET());
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET());
  return payload as unknown as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET());
  return payload as unknown as TokenPayload;
}

// Cookie config
const isProd = () => process.env.NODE_ENV === "production";

/** Options for the access token cookie (10h).
 */
export const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax",
  path: "/",
  maxAge: 10 * 60 * 60 * 1000, // 10 hours in milliseconds
};

/** Options for the refresh token cookie (30d). */
export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax",
  path: "/",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/** Matching clear options — must have the same path as set options. */
export const clearAccessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax",
  path: "/",
};

export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax",
  path: "/",
};
