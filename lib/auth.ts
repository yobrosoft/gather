import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import { newId } from "@/lib/ids";
import { ServiceError } from "@/lib/service";
import { dataDir, getStore } from "@/lib/store";
import type { UserRecord } from "@/lib/types";

const COOKIE = "gather_session";
const MAX_AGE = 60 * 60 * 24 * 30;

type SessionPayload = { uid: string; exp: number };

function secret(): string {
  const fromEnv = process.env.GATHER_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join(dataDir(), "session.secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(file, "utf8").trim();
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function mintSession(userId: string): string {
  const payload: SessionPayload = { uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionUserId(token: string | undefined): string | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.uid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, request: Request): string {
  const secure = request.url.startsWith("https://");
  const parts = [
    `${COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export async function currentUser(request: Request): Promise<UserRecord | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const userId = readSessionUserId(token);
  if (!userId) return null;
  const store = await getStore();
  return store.getUser(userId);
}

export async function userFromGoogle(credential: string): Promise<UserRecord> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new ServiceError("Google sign-in is not configured.", 403);
  const client = new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new ServiceError("Google did not return an account.", 401);
    return upsertAccount(`google:${payload.sub}`, payload.name?.trim() || payload.email, payload.email);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("Google sign-in did not complete.", 401);
  }
}

export async function userFromDev(name: string, email: string): Promise<UserRecord> {
  if (process.env.GATHER_DEV_AUTH !== "1") throw new ServiceError("Dev sign-in is off.", 403);
  return upsertAccount(`dev:${email.trim().toLowerCase()}`, name.trim(), email.trim().toLowerCase());
}

async function upsertAccount(sub: string, name: string, email: string): Promise<UserRecord> {
  const store = await getStore();
  const existing = await store.findUserBySub(sub);
  if (existing) {
    existing.name = name;
    existing.email = email;
    await store.saveUser(existing);
    return existing;
  }
  const user: UserRecord = { id: newId(), googleSub: sub, name, email, churchId: null };
  await store.saveUser(user);
  return user;
}
