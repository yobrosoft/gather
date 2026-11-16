import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { listEnquiryViews } from "@/lib/service";
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
