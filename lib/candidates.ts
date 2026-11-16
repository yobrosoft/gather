import type { CandidateStatus, ChurchRequestRecord, CinemaCandidate } from "@/lib/types";

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  considering: "Not contacted",
  enquired: "Enquiry sent",
  quoted: "Quoted",
  unavailable: "Can't do this date",
  chosen: "We'll book this one",
};

export function withCandidates(request: ChurchRequestRecord): ChurchRequestRecord {
  const source = request.candidates?.length
    ? request.candidates
    : request.cinemaPlaceId
      ? [{ cinemaId: request.cinemaPlaceId, status: "considering" as const, quote: "", note: "" }]
      : [];
  return {
    ...request,
    candidates: source.map((candidate) => ({
      cinemaId: candidate.cinemaId,
      status: candidate.status,
      quote: candidate.quote ?? "",
      note: candidate.note ?? "",
    })),
  };
}

export function candidatesFromCinemas(cinemaIds: string[]): CinemaCandidate[] {
  return cinemaIds.map((cinemaId) => ({ cinemaId, status: "considering", quote: "", note: "" }));
}

export function applyCandidateUpdate(
  candidates: CinemaCandidate[],
  update: { cinemaId: string; status: CandidateStatus; quote: string; note?: string },
): CinemaCandidate[] {
  const next = candidates.map((candidate) => {
    if (candidate.cinemaId !== update.cinemaId) {
      const status: CandidateStatus = candidate.quote ? "quoted" : "enquired";
      return update.status === "chosen" && candidate.status === "chosen" ? { ...candidate, status } : candidate;
    }
    return { cinemaId: update.cinemaId, status: update.status, quote: update.quote, note: update.note ?? candidate.note ?? "" };
  });
  if (!next.some((candidate) => candidate.cinemaId === update.cinemaId)) {
    throw new Error("That cinema is not on this shortlist.");
  }
  return next;
}
