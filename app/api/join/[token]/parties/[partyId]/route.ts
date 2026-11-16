import { NextResponse } from "next/server";
import { isJoinToken } from "@/lib/ids";
import { assertSameOrigin, fail, requireUser } from "@/lib/http";
import { removePartyByToken, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string; partyId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { token, partyId } = await context.params;
    if (!isJoinToken(token)) throw new ServiceError("That link does not match a viewing.", 404);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await removePartyByToken(store, user, token, partyId) });
  } catch (error) {
    return fail(error);
  }
}
