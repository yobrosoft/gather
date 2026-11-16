import { NextResponse } from "next/server";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { churchRequestInput, issueMessage } from "@/lib/schema";
import { createChurchRequest, listEnquiryViews, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiries: await listEnquiryViews(store, user) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = churchRequestInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    const enquiry = await createChurchRequest(store, user, parsed.data);
    return NextResponse.json({ enquiry });
  } catch (error) {
    return fail(error);
  }
}
