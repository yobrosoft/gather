import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { fail } from "@/lib/http";
import { churchClaimStatus, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const placeId = new URL(request.url).searchParams.get("placeId")?.trim() ?? "";
    if (!placeId) throw new ServiceError("Search Google Maps and pick your church.", 400);
    const store = await getStore();
    const user = await currentUser(request);
    return NextResponse.json(await churchClaimStatus(store, placeId, user));
  } catch (error) {
    return fail(error);
  }
}
