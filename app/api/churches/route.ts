import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { churchInput, churchPatchInput, issueMessage } from "@/lib/schema";
import { claimChurch, ServiceError, sessionView, updateChurch } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = churchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    await claimChurch(store, user, parsed.data);
    return NextResponse.json(await sessionView(store, user));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = churchPatchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    await updateChurch(store, user, parsed.data);
    return NextResponse.json(await sessionView(store, user));
  } catch (error) {
    return fail(error);
  }
}
