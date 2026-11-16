import { z } from "zod";

export const churchInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    placeId: z.string().max(200).optional(),
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
    address: z.string().max(300).optional(),
  })
  .strict();

export const churchPatchInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    placeId: z.string().max(200).optional(),
    lat: z.number().gte(-90).lte(90).optional(),
    lng: z.number().gte(-180).lte(180).optional(),
    address: z.string().max(300).optional(),
    catchment: z
      .array(
        z.object({
          lat: z.number().gte(-90).lte(90),
          lng: z.number().gte(-180).lte(180),
          label: z.string().trim().min(1).max(40),
        }),
      )
      .max(4)
      .optional(),
  })
  .strict();

export const joinChurchInput = z
  .object({
    code: z.string().trim().min(4).max(32),
  })
  .strict();

const cinemaInput = z.object({
  placeId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(160),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  address: z.string().max(300).optional(),
});

const scriptureSelection = z
  .object({
    bibleId: z.number().int().positive().max(1_000_000),
    passageId: z.string().trim().min(5).max(24),
  })
  .strict();

const legacyVerse = z
  .object({
    reference: z.string().trim().min(1).max(120),
    text: z.string().trim().max(8000).optional(),
    translation: z.string().trim().max(24).optional(),
    copyright: z.string().trim().max(800).optional(),
  })
  .strict();

const verseInput = z.union([scriptureSelection, legacyVerse]);

const bookingStatusInput = z.enum(["tbd", "pending", "booked"]);

export const screeningInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    durationMinutes: z.number().int().min(1).max(600),
    videoUrl: z.string().trim().max(300).optional(),
    verses: z.array(verseInput).max(12),
    bookingStatus: bookingStatusInput,
    startsAt: z.string().min(1),
    timeZone: z.string().trim().min(1).max(80),
    capacity: z.number().int().min(1).max(2000),
    visibility: z.enum(["private", "open"]),
    cinema: cinemaInput.nullable().optional(),
  })
  .strict();

export const screeningPatchInput = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    videoUrl: z.string().trim().max(300).optional(),
    verses: z.array(verseInput).max(12).optional(),
    bookingStatus: bookingStatusInput.optional(),
    startsAt: z.string().min(1).optional(),
    timeZone: z.string().trim().min(1).max(80).optional(),
    capacity: z.number().int().min(1).max(2000).optional(),
    visibility: z.enum(["private", "open"]).optional(),
    cinema: cinemaInput.nullable().optional(),
  })
  .strict();

export const partyInput = z
  .object({
    members: z.number().int().min(0).max(500),
    guests: z.number().int().min(0).max(500),
  })
  .strict();

export const devSessionInput = z
  .object({
    devName: z.string().trim().min(1).max(80),
    devEmail: z.string().trim().email().max(200),
  })
  .strict();

export const googleSessionInput = z
  .object({
    credential: z.string().min(20),
  })
  .strict();

export function issueMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Check those details.";
}
