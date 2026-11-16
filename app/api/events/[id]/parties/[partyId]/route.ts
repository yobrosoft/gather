import { NextResponse } from "next/server";
import { assertSameOrigin, fail, requireUser } from "@/lib/http";
import { removeParty } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; partyId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { id, partyId } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await removeParty(store, user, id, partyId) });
  } catch (error) {
    return fail(error);
  }
}
