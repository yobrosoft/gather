import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { assertSameOrigin, fail, readBody, requireUser } from "@/lib/http";
import { issueMessage, screeningInput } from "@/lib/schema";
import { versesForStorage } from "@/lib/scripture";
import { createScreening, listEvents, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const store = await getStore();
    const user = await currentUser(request);
    return NextResponse.json({ events: await listEvents(store, user) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = screeningInput.safeParse(await readBody(request));
    if (!parsed.success) throw new ServiceError(issueMessage(parsed.error), 400);
    const store = await getStore();
    const user = await requireUser(request);
    const verses = await versesForStorage(parsed.data.verses);
    const event = await createScreening(store, user, { ...parsed.data, verses });
    return NextResponse.json({ event });
  } catch (error) {
    return fail(error);
  }
}
