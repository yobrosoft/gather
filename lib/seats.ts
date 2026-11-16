export type SeatParty = {
  id?: string;
  members: number;
  guests: number;
};

export function partySize(party: { members: number; guests: number }): number {
  return party.members + party.guests;
}

export function seatsTaken(parties: Array<{ members: number; guests: number }>): number {
  return parties.reduce((sum, party) => sum + partySize(party), 0);
}

export function seatsRemaining(capacity: number, parties: Array<{ members: number; guests: number }>): number {
  return capacity - seatsTaken(parties);
}

export function partyProblem(members: number, guests: number): string | null {
  if (!Number.isInteger(members) || !Number.isInteger(guests) || members < 0 || guests < 0) {
    return "Enter whole numbers of members and guests.";
  }
  if (members + guests < 1) return "Add at least one person.";
  return null;
}

/** Returns an error message when the party does not fit, or null when it does. */
export function fitProblem(
  capacity: number,
  parties: SeatParty[],
  next: { members: number; guests: number },
  replaceId?: string,
): string | null {
  const invalid = partyProblem(next.members, next.guests);
  if (invalid) return invalid;
  const kept = replaceId ? parties.filter((party) => party.id !== replaceId) : parties;
  const remaining = capacity - seatsTaken(kept);
  if (partySize(next) > remaining) {
    if (remaining <= 0) return "This theatre is full.";
    return remaining === 1 ? "Only 1 seat is left." : `Only ${remaining} seats are left.`;
  }
  return null;
}
