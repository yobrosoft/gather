import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { enquiryPatchInput, issueMessage } from "@/lib/schema";
import { ServiceError, updateEnquiry } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const parsed = enquiryPatchInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const { id } = await context.params;
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiry: await updateEnquiry(store, user, id, parsed.data) });
  } catch (error) {
    return fail(error);
  }
}
