import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { arrangeDraftInput, issueMessage } from "@/lib/schema";
import { saveArrangeDraft, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = arrangeDraftInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiry: await saveArrangeDraft(store, user, parsed.data) });
  } catch (error) {
    return fail(error);
  }
}
