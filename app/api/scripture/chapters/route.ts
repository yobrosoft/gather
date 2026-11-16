import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { listChapters } from "@/lib/scripture";
import { ServiceError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const url = new URL(request.url);
    const bibleId = Number(url.searchParams.get("bibleId"));
    const book = url.searchParams.get("book")?.trim().toUpperCase() ?? "";
    if (!Number.isInteger(bibleId) || bibleId < 1 || !/^[A-Z0-9]{3}$/.test(book)) {
      throw new ServiceError("Choose a translation and a book.", 400);
    }
    return NextResponse.json({ chapters: await listChapters(bibleId, book) });
  } catch (error) {
    return fail(error);
  }
}
