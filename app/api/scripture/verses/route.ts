import { NextResponse } from "next/server";
import { fail, requireUser } from "@/lib/http";
import { listVerses } from "@/lib/scripture";
import { ServiceError } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const url = new URL(request.url);
    const bibleId = Number(url.searchParams.get("bibleId"));
    const book = url.searchParams.get("book")?.trim().toUpperCase() ?? "";
    const chapter = Number(url.searchParams.get("chapter"));
    if (!Number.isInteger(bibleId) || bibleId < 1 || !/^[A-Z0-9]{3}$/.test(book) || !Number.isInteger(chapter) || chapter < 1) {
      throw new ServiceError("Choose a book and chapter.", 400);
    }
    return NextResponse.json({ verses: await listVerses(bibleId, book, chapter) });
  } catch (error) {
    return fail(error);
  }
}
