import { randomInt, randomUUID } from "crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newId(): string {
  return randomUUID();
}

export function inviteCode(): string {
  return token(8);
}

export function joinToken(): string {
  return token(16);
}

export function referenceCode(prefix: "R" | "E"): string {
  return `${prefix}-${token(4)}`;
}

export function isJoinToken(value: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/.test(value);
}

function token(length: number): string {
  let code = "";
  for (let index = 0; index < length; index += 1) code += alphabet[randomInt(alphabet.length)];
  return code;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
