import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, joinChurchInput } from "@/lib/schema";
import { joinChurch, ServiceError, sessionView } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = joinChurchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    await joinChurch(store, user, parsed.data.code);
    return NextResponse.json(await sessionView(store, user));
  } catch (error) {
    return fail(error);
  }
}
