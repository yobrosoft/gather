import "server-only";

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ServiceError } from "@/lib/service";
import type { UserRecord } from "@/lib/types";

export function fail(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message === "Google sign-in is not configured." || message === "Dev sign-in is off.") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message === "Google did not return an account.") {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ServiceError("The request body was not valid.", 400);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new ServiceError("That request came from another site.", 403);
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new ServiceError("That request came from another site.", 403);
  }
  if (url.host !== host) throw new ServiceError("That request came from another site.", 403);
}

export async function requireUser(request: Request): Promise<UserRecord> {
  const user = await currentUser(request);
  if (!user) throw new ServiceError("Sign in required.", 401);
  return user;
}
