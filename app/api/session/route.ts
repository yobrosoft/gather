import { NextResponse } from "next/server";
import { clearSessionCookie, mintSession, sessionCookie, userFromDev, userFromGoogle, userFromPassword, currentUser } from "@/lib/auth";
import { assertSameOrigin, fail, readBody } from "@/lib/http";
import { devSessionInput, googleSessionInput, issueMessage, passwordSessionInput } from "@/lib/schema";
import { ServiceError, sessionView } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user) return NextResponse.json({ user: null, church: null });
    return NextResponse.json(await sessionView(await getStore(), user));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    const user =
      body && typeof body === "object" && "credential" in body
        ? await userFromGoogle(googleCredential(body))
        : body && typeof body === "object" && "password" in body
          ? await userFromPassword(passwordAccount(body))
          : await userFromDev(...devAccount(body));
    const response = NextResponse.json(await sessionView(await getStore(), user));
    response.headers.set("Set-Cookie", sessionCookie(mintSession(user.id), request));
    return response;
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ user: null, church: null });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return fail(error);
  }
}

function googleCredential(body: unknown): string {
  const parsed = googleSessionInput.safeParse(body);
  if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
  return parsed.data.credential;
}

function passwordAccount(body: unknown) {
  const parsed = passwordSessionInput.safeParse(body);
  if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
  return parsed.data;
}

function devAccount(body: unknown): [string, string] {
  const parsed = devSessionInput.safeParse(body);
  if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
  return [parsed.data.devName, parsed.data.devEmail];
}
