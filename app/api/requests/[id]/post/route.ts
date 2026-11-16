import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, publishInput } from "@/lib/schema";
import { postArrangeDraft, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = publishInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiry: await postArrangeDraft(store, user, id, parsed.data.publish) });
  } catch (error) {
    return fail(error);
  }
}
