import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { listBibles } from "@/lib/scripture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return NextResponse.json({ bibles: await listBibles() });
  } catch (error) {
    return fail(error);
  }
}
