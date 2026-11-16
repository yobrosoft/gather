import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, encoded] = stored.split("$");
  if (kind !== "scrypt" || !salt || !encoded) return false;
  const next = (await scryptAsync(password, salt, 32)) as Buffer;
  const previous = Buffer.from(encoded, "base64url");
  if (next.length !== previous.length) return false;
  return timingSafeEqual(next, previous);
}
