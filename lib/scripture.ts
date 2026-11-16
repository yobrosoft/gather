import { readFileSync, existsSync } from "fs";
import path from "path";
import { homedir } from "os";
import { ServiceError } from "@/lib/service";
import type { Verse } from "@/lib/types";

const BOOK_NAMES: Record<string, string> = {
  GEN: "Genesis",
  EXO: "Exodus",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEU: "Deuteronomy",
  JOS: "Joshua",
  JDG: "Judges",
  RUT: "Ruth",
  "1SA": "1 Samuel",
  "2SA": "2 Samuel",
  "1KI": "1 Kings",
  "2KI": "2 Kings",
  "1CH": "1 Chronicles",
  "2CH": "2 Chronicles",
  EZR: "Ezra",
  NEH: "Nehemiah",
  EST: "Esther",
  JOB: "Job",
  PSA: "Psalms",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SNG: "Song of Solomon",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  EZK: "Ezekiel",
  DAN: "Daniel",
  HOS: "Hosea",
  JOL: "Joel",
  AMO: "Amos",
  OBA: "Obadiah",
  JON: "Jonah",
  MIC: "Micah",
  NAM: "Nahum",
  HAB: "Habakkuk",
  ZEP: "Zephaniah",
  HAG: "Haggai",
  ZEC: "Zechariah",
  MAL: "Malachi",
  MAT: "Matthew",
  MRK: "Mark",
  LUK: "Luke",
  JHN: "John",
  ACT: "Acts",
  ROM: "Romans",
  "1CO": "1 Corinthians",
  "2CO": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHP: "Philippians",
  COL: "Colossians",
  "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians",
  "1TI": "1 Timothy",
  "2TI": "2 Timothy",
  TIT: "Titus",
  PHM: "Philemon",
  HEB: "Hebrews",
  JAS: "James",
  "1PE": "1 Peter",
  "2PE": "2 Peter",
  "1JN": "1 John",
  "2JN": "2 John",
  "3JN": "3 John",
  JUD: "Jude",
  REV: "Revelation",
};

const PREFERRED = ["NIV", "ESV", "NLT", "NKJV", "CSB", "NASB", "KJV", "BSB", "WEB", "ASV"];

export type BibleSummary = {
  id: number;
  abbreviation: string;
  title: string;
};

export type BibleBook = {
  code: string;
  name: string;
};

export type BibleDetail = BibleSummary & {
  copyright: string;
  books: BibleBook[];
};

export type ChapterOption = {
  number: number;
  passageId: string;
};

export type VerseOption = {
  number: number;
  passageId: string;
};

export type PassageText = {
  id: string;
  reference: string;
  content: string;
  bibleId: number;
  abbreviation: string;
  copyright: string;
};

type VerseRequest =
  | { bibleId: number; passageId: string }
  | { reference: string; text?: string; translation?: string; copyright?: string };

const BASE = "https://api.youversion.com";

export function bookName(code: string): string {
  return BOOK_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export function canonicalPassageId(raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 24 || /[ /\\%?#&]/.test(value)) {
    throw new ServiceError("Choose a book, chapter, and verse.", 400);
  }
  const dot = value.indexOf(".");
  if (dot !== 3) throw new ServiceError("Choose a book, chapter, and verse.", 400);
  const book = value.slice(0, 3).toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(book)) throw new ServiceError("Choose a book, chapter, and verse.", 400);
  const rest = value.slice(4);
  const verseDot = rest.indexOf(".");
  const chapterPart = verseDot === -1 ? rest : rest.slice(0, verseDot);
  const chapter = smallInt(chapterPart);
  if (verseDot === -1) return `${book}.${chapter}`;
  const versePart = rest.slice(verseDot + 1);
  const dash = versePart.indexOf("-");
  const start = smallInt(dash === -1 ? versePart : versePart.slice(0, dash));
  if (dash === -1) return `${book}.${chapter}.${start}`;
  const endPart = versePart.slice(dash + 1);
  if (endPart.includes(".")) throw new ServiceError("A verse range stays inside one chapter.", 400);
  const end = smallInt(endPart);
  if (end < start) throw new ServiceError("The last verse comes after the first.", 400);
  return `${book}.${chapter}.${start}-${end}`;
}

export function passageId(book: string, chapter: number, start: number, end?: number): string {
  const range = end && end !== start ? `${start}-${end}` : String(start);
  return canonicalPassageId(`${book}.${chapter}.${range}`);
}

function smallInt(value: string): number {
  if (!/^\d{1,3}$/.test(value)) throw new ServiceError("Use a chapter or verse from 1 to 999.", 400);
  const number = Number(value);
  if (number < 1) throw new ServiceError("Use a chapter or verse from 1 to 999.", 400);
  return number;
}

export function sortBibles(bibles: BibleSummary[]): BibleSummary[] {
  const rank = (abbreviation: string) => {
    const index = PREFERRED.indexOf(abbreviation.toUpperCase());
    return index === -1 ? PREFERRED.length : index;
  };
  return bibles.slice().sort((a, b) => rank(a.abbreviation) - rank(b.abbreviation) || a.abbreviation.localeCompare(b.abbreviation));
}

export function youversionConfigured(): boolean {
  return Boolean(appKey());
}

function appKey(): string {
  const fromEnv = process.env.YVP_APP_KEY?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join(homedir(), ".config", "youversion-bible-mcp", "secrets.env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((entry) => entry.trim().startsWith("YVP_APP_KEY="));
  return line?.slice("YVP_APP_KEY=".length).trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function requireKey(): string {
  const key = appKey();
  if (!key) throw new ServiceError("Bible lookup needs a YouVersion app key on this server.", 503);
  return key;
}

async function yvpGet(path: string, query?: Record<string, string>): Promise<unknown> {
  const key = requireKey();
  if (!allowedPath(path)) throw new ServiceError("That Bible request is not allowed.", 400);
  const url = new URL(path, BASE);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "X-YVP-App-Key": key,
        accept: "application/json",
        "user-agent": "Gather/0.1",
      },
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new ServiceError("YouVersion could not be reached.", 502);
  }
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ServiceError("YouVersion did not accept the app key.", 502);
    }
    if (response.status === 404) throw new ServiceError("That verse is not in this translation.", 404);
    throw new ServiceError("YouVersion could not return that passage.", response.status === 429 ? 429 : 502);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ServiceError("YouVersion returned an unreadable response.", 502);
  }
}

function allowedPath(path: string): boolean {
  if (path === "/v1/bibles") return true;
  const match = /^\/v1\/bibles\/(\d+)(?:\/(passages|books)\/([A-Za-z0-9.]+))?(?:\/chapters(?:\/(\d+)(?:\/verses)?)?)?$/.exec(path);
  if (!match) return false;
  if (match[2] === "passages") {
    try {
      return canonicalPassageId(match[3] ?? "") === (match[3] ?? "").toUpperCase();
    } catch {
      return false;
    }
  }
  if (match[2] === "books") return /^[A-Z0-9]{3}$/.test((match[3] ?? "").toUpperCase());
  return !match[2];
}

function unquote(value: string): string {
  return value.trim().replace(/^"+|"+$/g, "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function listBibles(): Promise<BibleSummary[]> {
  const found: BibleSummary[] = [];
  let pageToken = "";
  for (let page = 0; page < 6; page += 1) {
    const query: Record<string, string> = { "language_ranges[]": "en", page_size: "50" };
    if (pageToken) query.page_token = pageToken;
    const payload = asRecord(await yvpGet("/v1/bibles", query));
    const data = Array.isArray(payload.data) ? payload.data : [];
    for (const item of data) {
      const row = asRecord(item);
      const id = Number(row.id);
      const abbreviation = String(row.abbreviation ?? row.localized_abbreviation ?? "").trim();
      const title = String(row.title ?? row.localized_title ?? abbreviation).trim();
      if (id > 0 && abbreviation) found.push({ id, abbreviation, title });
    }
    pageToken = typeof payload.next_page_token === "string" ? payload.next_page_token : "";
    if (!pageToken) break;
  }
  return sortBibles(found);
}

export async function getBible(id: number): Promise<BibleDetail> {
  const row = asRecord(await yvpGet(`/v1/bibles/${id}`));
  const codes = Array.isArray(row.books) ? row.books.filter((code): code is string => typeof code === "string") : [];
  return {
    id: Number(row.id) || id,
    abbreviation: String(row.abbreviation ?? ""),
    title: String(row.title ?? ""),
    copyright: unquote(String(row.copyright ?? "")),
    books: codes.map((code) => ({ code: code.toUpperCase(), name: bookName(code) })),
  };
}

export async function listChapters(bibleId: number, book: string): Promise<ChapterOption[]> {
  const code = book.toUpperCase();
  const payload = asRecord(await yvpGet(`/v1/bibles/${bibleId}/books/${code}/chapters`));
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.flatMap((item) => {
    const row = asRecord(item);
    const number = Number(row.title ?? row.id);
    const passage = String(row.passage_id ?? `${code}.${number}`);
    return number > 0 ? [{ number, passageId: passage }] : [];
  });
}

export async function listVerses(bibleId: number, book: string, chapter: number): Promise<VerseOption[]> {
  const code = book.toUpperCase();
  const payload = asRecord(await yvpGet(`/v1/bibles/${bibleId}/books/${code}/chapters/${chapter}/verses`));
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.flatMap((item) => {
    const row = asRecord(item);
    const number = Number(row.title ?? row.id);
    const passage = String(row.passage_id ?? `${code}.${chapter}.${number}`);
    return number > 0 ? [{ number, passageId: passage }] : [];
  });
}

export async function getPassage(bibleId: number, passage: string): Promise<PassageText> {
  const id = canonicalPassageId(passage);
  const bible = await getBible(bibleId);
  const row = asRecord(await yvpGet(`/v1/bibles/${bible.id}/passages/${id}`, { format: "text" }));
  const content = String(row.content ?? "").trim();
  if (!content) throw new ServiceError("YouVersion did not return text for that verse.", 404);
  if (content.length > 8000) throw new ServiceError("Choose a shorter passage.", 400);
  return {
    id: String(row.id || id),
    reference: String(row.reference ?? "").trim() || id,
    content,
    bibleId: bible.id,
    abbreviation: bible.abbreviation,
    copyright: bible.copyright,
  };
}

export async function versesForStorage(input: VerseRequest[]): Promise<Verse[]> {
  const stored: Verse[] = [];
  for (const verse of input) {
    if ("bibleId" in verse) {
      const passage = await getPassage(verse.bibleId, verse.passageId);
      stored.push({
        reference: passage.reference,
        text: passage.content,
        translation: passage.abbreviation,
        bibleId: passage.bibleId,
        passageId: passage.id,
        copyright: passage.copyright,
      });
    } else if (verse.reference.trim()) {
      stored.push({
        reference: verse.reference.trim(),
        text: verse.text?.trim() ?? "",
        ...(verse.translation?.trim() ? { translation: verse.translation.trim() } : {}),
        ...(verse.copyright?.trim() ? { copyright: verse.copyright.trim() } : {}),
      });
    }
  }
  return stored;
}
