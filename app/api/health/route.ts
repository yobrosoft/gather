import { NextResponse } from "next/server";
import { storeKind } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, store: storeKind() });
}
