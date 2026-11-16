import { NextResponse } from "next/server";
import { isJoinToken } from "@/lib/ids";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, partyInput } from "@/lib/schema";
import { addPartyByToken, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { token } = await context.params;
    if (!isJoinToken(token)) throw new ServiceError("That link does not match a viewing.", 404);
    const parsed = partyInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await addPartyByToken(store, user, token, parsed.data) });
  } catch (error) {
    return fail(error);
  }
}
