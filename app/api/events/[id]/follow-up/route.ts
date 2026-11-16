import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { followUpInput, issueMessage } from "@/lib/schema";
import { listFollowUpViews, saveFollowUp, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ followUps: await listFollowUpViews(store, user, id) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = followUpInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    const followUp = await saveFollowUp(store, user, id, parsed.data);
    return NextResponse.json({ followUp });
  } catch (error) {
    return fail(error);
  }
}
