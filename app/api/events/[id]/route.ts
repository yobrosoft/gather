import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, screeningPatchInput } from "@/lib/schema";
import { versesForStorage } from "@/lib/scripture";
import { getEvent, ServiceError, updateScreening } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const user = await currentUser(request);
    return NextResponse.json({ event: await getEvent(store, user, id) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsed = screeningPatchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    const verses = parsed.data.verses ? await versesForStorage(parsed.data.verses) : undefined;
    return NextResponse.json({ event: await updateScreening(store, user, id, { ...parsed.data, verses }) });
  } catch (error) {
    return fail(error);
  }
}
