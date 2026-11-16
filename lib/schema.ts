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
const requestModeInput = z.enum(["private", "shared"]);
const requestStatusInput = z.enum(["sent", "accepted", "declined", "needs_partner"]);

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
    screeningMode: requestModeInput.optional(),
    requestStatus: requestStatusInput.optional(),
    expectedHeadcount: z.number().int().min(1).max(5000).optional(),
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
    screeningMode: requestModeInput.optional(),
    requestStatus: requestStatusInput.optional(),
    expectedHeadcount: z.number().int().min(1).max(5000).optional(),
  })
  .strict();

export const churchRequestInput = z
  .object({
    mode: requestModeInput,
    expectedHeadcount: z.number().int().min(1).max(2000),
    preferredDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(3),
    preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    cinema: cinemaInput.optional(),
    cinemas: z.array(cinemaInput).min(1).max(6).optional(),
    accessibilityNeeds: z.string().trim().max(500),
    coordinatorName: z.string().trim().min(1).max(80),
    coordinatorPhone: z.string().trim().max(40),
    coordinatorEmail: z.string().trim().email().max(200),
  })
  .strict()
  .refine((data) => Boolean(data.cinema) || Boolean(data.cinemas?.length), { message: "Add at least one cinema." });

export const arrangeDraftInput = z
  .object({
    requestId: z.string().trim().min(1).max(80).optional(),
    mode: requestModeInput,
    expectedHeadcount: z.number().int().min(1).max(2000),
    preferredDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(3),
    preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    cinemas: z.array(cinemaInput).max(6),
    candidates: z
      .array(
        z
          .object({
            cinemaId: z.string().trim().min(1).max(80),
            status: z.enum(["considering", "enquired", "quoted", "unavailable", "chosen"]),
            quote: z.string().trim().max(80),
            note: z.string().trim().max(500).optional(),
          })
          .strict(),
      )
      .max(6)
      .optional(),
    accessibilityNeeds: z.string().trim().max(500),
    coordinatorName: z.string().trim().min(1).max(80),
    coordinatorPhone: z.string().trim().max(40),
    coordinatorEmail: z.string().trim().email().max(200),
    hostedBy: z.string().trim().max(80),
  })
  .strict();

export const candidatePatchInput = z
  .object({
    cinemaId: z.string().trim().min(1).max(80),
    status: z.enum(["considering", "enquired", "quoted", "unavailable", "chosen"]),
    quote: z.string().trim().max(80),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const enquiryPatchInput = z
  .object({
    proposedHall: z.string().trim().max(120).optional(),
    proposedWhen: z.string().trim().max(40).optional(),
    proposedTerms: z.string().trim().max(2000).optional(),
    verifiedAvailability: z.boolean().optional(),
    verifiedRights: z.boolean().optional(),
    verifiedTerms: z.boolean().optional(),
    simulate: z.boolean().optional(),
  })
  .strict();

export const publishInput = z
  .object({
    publish: z.boolean(),
  })
  .strict();

export const attendanceDecisionInput = z
  .object({
    action: z.enum(["accept", "declineUpdate", "revoke"]),
  })
  .strict();

export const followUpInput = z
  .object({
    kind: z.enum(["discussion", "introduction", "none"]),
    shareContact: z.boolean(),
    name: z.string().trim().max(80).optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
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

export const passwordSessionInput = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(200),
    name: z.string().trim().max(80).optional(),
    signup: z.boolean(),
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
