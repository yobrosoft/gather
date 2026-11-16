import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { attendanceDecisionInput, issueMessage } from "@/lib/schema";
import { decideAttendance, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; partyId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = attendanceDecisionInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id, partyId } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await decideAttendance(store, user, id, partyId, parsed.data.action) });
  } catch (error) {
    return fail(error);
  }
}
