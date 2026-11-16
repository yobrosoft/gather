import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { getBible } from "@/lib/scripture";
import { ServiceError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const bibleId = Number(id);
    if (!Number.isInteger(bibleId) || bibleId < 1) throw new ServiceError("Choose a translation.", 400);
    return NextResponse.json({ bible: await getBible(bibleId) });
  } catch (error) {
    return fail(error);
  }
}
