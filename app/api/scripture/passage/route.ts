import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { getPassage } from "@/lib/scripture";
import { ServiceError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const url = new URL(request.url);
    const bibleId = Number(url.searchParams.get("bibleId"));
    const passage = url.searchParams.get("passage")?.trim() ?? "";
    if (!Number.isInteger(bibleId) || bibleId < 1 || !passage) throw new ServiceError("Choose a translation and a verse.", 400);
    const text = await getPassage(bibleId, passage);
    return NextResponse.json({
      reference: text.reference,
      text: text.content,
      translation: text.abbreviation,
      bibleId: text.bibleId,
      passageId: text.id,
      copyright: text.copyright,
    });
  } catch (error) {
    return fail(error);
  }
}
