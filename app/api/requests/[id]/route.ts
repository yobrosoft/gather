import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { candidatePatchInput, issueMessage } from "@/lib/schema";
import { ServiceError, updateCandidate } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = candidatePatchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiry: await updateCandidate(store, user, id, parsed.data) });
  } catch (error) {
    return fail(error);
  }
}
