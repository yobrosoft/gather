import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { ServiceError, venueHolds } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const url = new URL(request.url);
    const startsAt = url.searchParams.get("startsAt")?.trim() ?? "";
    const timeZone = url.searchParams.get("timeZone")?.trim() ?? "";
    const except = url.searchParams.get("except")?.trim() || undefined;
    if (!startsAt || !timeZone) throw new ServiceError("Set the date before you choose a cinema.", 400);
    const store = await getStore();
    return NextResponse.json({ holds: await venueHolds(store, startsAt, timeZone, except) });
  } catch (error) {
    return fail(error);
  }
}
