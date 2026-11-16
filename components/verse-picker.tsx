"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { Verse } from "@/lib/types";

type BibleOption = { id: number; abbreviation: string; title: string };
type BookOption = { code: string; name: string };
type NumberOption = { number: number };

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "YouVersion could not be reached.");
  return body;
}

export function VersePicker({ verses, onChange }: { verses: Verse[]; onChange: (verses: Verse[]) => void }) {
  const [bibles, setBibles] = useState<BibleOption[]>([]);
  const [bibleId, setBibleId] = useState<number | null>(null);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [book, setBook] = useState("JHN");
  const [chapters, setChapters] = useState<NumberOption[]>([]);
  const [chapter, setChapter] = useState(0);
  const [verseOptions, setVerseOptions] = useState<NumberOption[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState(false);
  const onChangeRef = useRef(onChange);
  const versesRef = useRef(verses);
  const liveKey = useRef<string | null>(null);
  onChangeRef.current = onChange;
  versesRef.current = verses;

  useEffect(() => {
    let cancel = false;
    loadJson<{ bibles: BibleOption[] }>("/api/scripture/bibles")
      .then((payload) => {
        if (cancel) return;
        setBibles(payload.bibles);
        const preferred = payload.bibles.find((bible) => bible.abbreviation === "NIV") ?? payload.bibles[0];
        if (preferred) setBibleId(preferred.id);
      })
      .catch((error: unknown) => {
        if (!cancel) setNote(error instanceof Error ? error.message : "YouVersion could not be reached.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!bibleId) return;
    let cancel = false;
    setBooks([]);
    loadJson<{ bible: { books: BookOption[] } }>(`/api/scripture/bibles/${bibleId}`)
      .then((payload) => {
        if (cancel) return;
        setBooks(payload.bible.books);
        setBook((current) => (payload.bible.books.some((item) => item.code === current) ? current : payload.bible.books[0]?.code ?? ""));
      })
      .catch((error: unknown) => {
        if (!cancel) setNote(error instanceof Error ? error.message : "That translation could not be opened.");
      });
    return () => {
      cancel = true;
    };
  }, [bibleId]);

  useEffect(() => {
    if (!bibleId || !book) return;
    let cancel = false;
    setChapters([]);
    setChapter(0);
    loadJson<{ chapters: Array<{ number: number }> }>(`/api/scripture/chapters?bibleId=${bibleId}&book=${book}`)
      .then((payload) => {
        if (cancel) return;
        setChapters(payload.chapters);
        setChapter(payload.chapters[0]?.number ?? 0);
      })
      .catch((error: unknown) => {
        if (!cancel) setNote(error instanceof Error ? error.message : "Chapters could not be loaded.");
      });
    return () => {
      cancel = true;
    };
  }, [bibleId, book]);

  useEffect(() => {
    if (!bibleId || !book || !chapter) return;
    let cancel = false;
    setVerseOptions([]);
    setStart(0);
    setEnd(0);
    loadJson<{ verses: Array<{ number: number }> }>(`/api/scripture/verses?bibleId=${bibleId}&book=${book}&chapter=${chapter}`)
      .then((payload) => {
        if (cancel) return;
        setVerseOptions(payload.verses);
        setStart(payload.verses[0]?.number ?? 0);
        setEnd(0);
      })
      .catch((error: unknown) => {
        if (!cancel) setNote(error instanceof Error ? error.message : "Verses could not be loaded.");
      });
    return () => {
      cancel = true;
    };
  }, [bibleId, book, chapter]);

  useEffect(() => {
    if (!touched || !bibleId || !book || !chapter || !start) return;
    let cancel = false;
    const passage = end > start ? `${book}.${chapter}.${start}-${end}` : `${book}.${chapter}.${start}`;
    setPending(true);
    loadJson<Verse>(`/api/scripture/passage?bibleId=${bibleId}&passage=${encodeURIComponent(passage)}`)
      .then((verse) => {
        if (cancel) return;
        const key = `${verse.bibleId}:${verse.passageId}`;
        const previous = liveKey.current;
        const withoutLive = previous
          ? versesRef.current.filter((item) => `${item.bibleId}:${item.passageId}` !== previous)
          : versesRef.current;
        const next = withoutLive.some((item) => `${item.bibleId}:${item.passageId}` === key)
          ? withoutLive
          : [...withoutLive, verse];
        liveKey.current = key;
        versesRef.current = next;
        onChangeRef.current(next);
        setNote("");
      })
      .catch((error: unknown) => {
        if (!cancel) setNote(error instanceof Error ? error.message : "That verse could not be loaded.");
      })
      .finally(() => {
        if (!cancel) setPending(false);
      });
    return () => {
      cancel = true;
    };
  }, [touched, bibleId, book, chapter, start, end]);

  function keepCurrentVerse() {
    liveKey.current = null;
    setTouched(false);
    setNote("Choose the next verse.");
  }

  const endChoices = verseOptions.filter((verse) => verse.number > start);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Bible verses</p>
      <p className="muted text-sm">Choose a translation and a verse. That text is saved on the viewing.</p>
      {bibles.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="text-[var(--muted)]">Translation</span>
            <select
              className="field-input mt-1"
              aria-label="Translation"
              value={bibleId ?? ""}
              onChange={(event) => {
                setTouched(true);
                setBibleId(Number(event.target.value));
              }}
            >
              {bibles.map((bible) => (
                <option key={bible.id} value={bible.id}>
                  {bible.abbreviation} — {bible.title}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-sm">
            <span className="text-[var(--muted)]">Book</span>
            <select className="field-input mt-1" aria-label="Book" value={book} onChange={(event) => {
              setTouched(true);
              setBook(event.target.value);
            }}>
              {books.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Chapter</span>
            <select
              className="field-input mt-1"
              aria-label="Chapter"
              value={chapter || ""}
              onChange={(event) => {
                setTouched(true);
                setChapter(Number(event.target.value));
              }}
            >
              {chapters.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Verse</span>
            <select
              className="field-input mt-1"
              aria-label="Verse"
              value={start || ""}
              onChange={(event) => {
                setTouched(true);
                const next = Number(event.target.value);
                setStart(next);
                if (end && end <= next) setEnd(0);
              }}
            >
              {verseOptions.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.number}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block text-sm">
            <span className="text-[var(--muted)]">Through verse</span>
            <select
              className="field-input mt-1"
              aria-label="Through verse"
              value={end || ""}
              onChange={(event) => {
                setTouched(true);
                setEnd(Number(event.target.value));
              }}
            >
              <option value="">This verse only</option>
              {endChoices.map((item) => (
                <option key={item.number} value={item.number}>
                  {item.number}
                </option>
              ))}
            </select>
          </label>
          {verses.length > 0 ? (
            <Button type="button" className="col-span-2" tone="plain" disabled={pending || verses.length >= 12} onClick={keepCurrentVerse}>
              Add another verse
            </Button>
          ) : null}
          {pending ? <p className="muted col-span-2 text-sm">Loading the verse…</p> : null}
        </div>
      ) : null}
      {note ? <p className="alert text-sm">{note}</p> : null}
      {verses.length > 0 ? (
        <ul className="space-y-2">
          {verses.map((verse, index) => (
            <li key={`${verse.passageId ?? verse.reference}-${index}`} className="verse">
              <p className="verse-ref">
                {verse.reference}
                {verse.translation ? ` · ${verse.translation}` : ""}
              </p>
              {verse.text ? <p className="verse-text whitespace-pre-wrap">{verse.text}</p> : null}
              {verse.copyright ? <p className="mt-2 text-xs text-[var(--muted)]">{verse.copyright}</p> : null}
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-[var(--danger)]"
                onClick={() => onChange(verses.filter((_, verseIndex) => verseIndex !== index))}
              >
                Remove verse
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
