import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, partyInput } from "@/lib/schema";
import { addParty, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const parsed = partyInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await addParty(store, user, id, parsed.data) });
  } catch (error) {
    return fail(error);
  }
}
