import { NextResponse } from "next/server";
import { assertSameOrigin, fail, requireUser } from "@/lib/http";
import { ensureTampinesDemo } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ enquiries: await ensureTampinesDemo(store, user) });
  } catch (error) {
    return fail(error);
  }
}
