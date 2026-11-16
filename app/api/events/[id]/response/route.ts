import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage } from "@/lib/schema";
import { ServiceError, setRequestStatus } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ requestStatus: z.enum(["sent", "accepted", "declined", "needs_partner"]) }).strict();

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = bodySchema.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await setRequestStatus(store, user, id, parsed.data.requestStatus) });
  } catch (error) {
    return fail(error);
  }
}
