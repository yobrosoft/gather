import type { EnquiryStatus, RequestMode } from "@/lib/types";

export type SeatRange = { min: number | null; max: number | null };
export type SeatFit = "fits" | "too_small" | "unverified";

export function seatFit(range: SeatRange, people: number): SeatFit {
  if (!Number.isInteger(people) || people < 1) return "unverified";
  if (range.min == null && range.max == null) return "unverified";
  const upper = range.max ?? range.min;
  const lower = range.min ?? range.max;
  if (upper != null && upper < people) return "too_small";
  if (lower != null && lower >= people) return "fits";
  return "unverified";
}

export function seatFitLabel(range: SeatRange, people: number, seatsLabel: string): string {
  if (!Number.isInteger(people) || people < 1) {
    return range.min == null && range.max == null ? "Seat count not verified." : `${seatsLabel}. Unverified.`;
  }
  const fit = seatFit(range, people);
  if (fit === "too_small") return `Too small for ${people}. Published range: ${seatsLabel}. Unverified.`;
  if (fit === "fits") return `Published range covers ${people}: ${seatsLabel}. Unverified for this date.`;
  if (range.min == null && range.max == null) return "Seat count not verified.";
  return `Some halls in this range may fit ${people}: ${seatsLabel}. Unverified.`;
}

export function fitRank(fit: SeatFit): number {
  if (fit === "fits") return 0;
  if (fit === "unverified") return 1;
  return 2;
}

export function weekendKey(dates: string[]): string {
  const sorted = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const first = sorted[0];
  if (!first) return "";
  const [year, month, day] = first.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function nextSaturdayISO(now = new Date()): string {
  const singapore = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const add = (6 - singapore.getUTCDay() + 7) % 7 || 7;
  singapore.setUTCDate(singapore.getUTCDate() + add);
  return singapore.toISOString().slice(0, 10);
}

export function openForMerge(status: EnquiryStatus): boolean {
  return status === "pending" || status === "proposed";
}

export function findSharedEnquiry<T extends { mode: RequestMode; cinemaPlaceId: string; weekendKey: string; status: EnquiryStatus }>(
  enquiries: T[],
  cinemaPlaceId: string,
  weekend: string,
): T | null {
  return (
    enquiries.find(
      (enquiry) =>
        enquiry.mode === "shared" &&
        enquiry.cinemaPlaceId === cinemaPlaceId &&
        enquiry.weekendKey === weekend &&
        openForMerge(enquiry.status),
    ) ?? null
  );
}

export function enquiryNext(enquiry: {
  status: EnquiryStatus;
  proposedHall: string;
  proposedTerms: string;
  proposedWhen: string;
  verifiedAvailability: boolean;
  verifiedRights: boolean;
  verifiedTerms: boolean;
}): string {
  if (enquiry.status === "declined") return "The cinema declined this enquiry.";
  if (enquiry.status === "confirmed") {
    return "The coordinator verified availability, screening rights, and terms. Friends can be invited.";
  }
  const proposed = Boolean(enquiry.proposedHall.trim() && enquiry.proposedTerms.trim() && enquiry.proposedWhen.trim());
  if (!proposed) return "The Chosen Singapore coordinator replies next and sends one enquiry to the cinema.";
  const missing = [
    enquiry.verifiedAvailability ? "" : "availability",
    enquiry.verifiedRights ? "" : "screening rights",
    enquiry.verifiedTerms ? "" : "terms",
  ].filter(Boolean);
  if (missing.length === 0) return "The coordinator verified availability, screening rights, and terms.";
  return `The cinema proposed terms. Review them with your church. The coordinator still needs to verify ${missing.join(", ")}.`;
}

export function readyToConfirm(enquiry: {
  proposedHall: string;
  proposedTerms: string;
  proposedWhen: string;
  verifiedAvailability: boolean;
  verifiedRights: boolean;
  verifiedTerms: boolean;
}): boolean {
  return Boolean(
    enquiry.proposedHall.trim() &&
      enquiry.proposedTerms.trim() &&
      enquiry.proposedWhen.trim() &&
      enquiry.verifiedAvailability &&
      enquiry.verifiedRights &&
      enquiry.verifiedTerms,
  );
}
