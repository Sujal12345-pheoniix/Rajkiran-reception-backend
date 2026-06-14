import { hash, compare } from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed);
}
