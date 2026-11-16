export type Visibility = "private" | "open";

export type BookingStatus = "tbd" | "pending" | "booked";

export type RequestMode = "private" | "shared";

export type RequestStatus = "sent" | "accepted" | "declined" | "needs_partner";

export type EnquiryStatus = "pending" | "proposed" | "confirmed" | "declined";

export type FollowUpKind = "discussion" | "introduction" | "none";

export type Verse = {
  reference: string;
  text: string;
  translation?: string;
  bibleId?: number;
  passageId?: string;
  copyright?: string;
};

export type PublicConfig = {
  mapsKey: string;
  googleClientId: string;
  devAuth: boolean;
};

export type CatchmentPin = {
  lat: number;
  lng: number;
  label: string;
};

export type UserRecord = {
  id: string;
  googleSub: string;
  name: string;
  email: string;
  churchId: string | null;
};

export type ChurchRecord = {
  id: string;
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  address: string;
  leaderUserId: string;
  ownerIds: string[];
  inviteCode: string;
  ownerInviteCode: string;
  catchment: CatchmentPin[];
  fictional?: boolean;
};

export type CinemaRecord = {
  id: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
};

export type ScreeningRecord = {
  id: string;
  hostChurchId: string;
  hostedBy?: string;
  cinemaId: string | null;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  verses: Verse[];
  bookingStatus: BookingStatus;
  screeningMode: RequestMode;
  requestStatus: RequestStatus;
  expectedHeadcount: number;
  startsAt: string;
  timeZone: string;
  capacity: number;
  visibility: Visibility;
  joinToken: string;
};

export type CandidateStatus = "considering" | "enquired" | "quoted" | "unavailable" | "chosen";

export type CinemaCandidate = {
  cinemaId: string;
  status: CandidateStatus;
  quote: string;
  note: string;
};

export type ChurchRequestRecord = {
  id: string;
  reference: string;
  enquiryId: string;
  churchId: string;
  mode: RequestMode;
  expectedHeadcount: number;
  preferredDates: string[];
  preferredTime: string;
  cinemaPlaceId: string;
  candidates: CinemaCandidate[];
  accessibilityNeeds: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  hostedBy?: string;
  createdAt: string;
};

export type EnquiryRecord = {
  id: string;
  reference: string;
  mode: RequestMode;
  cinemaPlaceId: string;
  weekendKey: string;
  status: EnquiryStatus;
  proposedHall: string;
  proposedWhen: string;
  proposedTerms: string;
  verifiedAvailability: boolean;
  verifiedRights: boolean;
  verifiedTerms: boolean;
  screeningId: string | null;
};

export type FollowUpView = {
  id: string;
  kind: FollowUpKind;
  shareContact: boolean;
  personName: string;
  name: string;
  email: string;
  phone: string;
  mine: boolean;
};

export type FollowUpRecord = {
  id: string;
  eventId: string;
  userId: string;
  kind: FollowUpKind;
  shareContact: boolean;
  name: string;
  email: string;
  phone: string;
};

export type AttendanceStatus = "requested" | "accepted" | "declined";

export type PartyRecord = {
  id: string;
  eventId: string;
  userId: string;
  churchId: string | null;
  members: number;
  guests: number;
  status?: AttendanceStatus;
  proposedMembers?: number | null;
  proposedGuests?: number | null;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  churchId: string | null;
  isChosenSg: boolean;
};

export type PublicChurch = {
  id: string;
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  address: string;
  isOwner: boolean;
  inviteCode: string;
  ownerInviteCode: string;
  catchment: CatchmentPin[];
  fictional: boolean;
};

export type EnquiryRequestView = {
  id: string;
  reference: string;
  churchId: string;
  churchName: string;
  fictional: boolean;
  expectedHeadcount: number;
  preferredDates: string[];
  preferredTime: string;
  accessibilityNeeds: string;
  candidates: CinemaCandidate[];
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  hostedBy: string;
  createdAt: string;
};

export type EnquiryView = {
  id: string;
  reference: string;
  mode: RequestMode;
  cinemaName: string;
  cinemaAddress: string;
  hasHall: boolean;
  weekendKey: string;
  status: EnquiryStatus;
  expectedTotal: number;
  proposedHall: string;
  proposedWhen: string;
  proposedTerms: string;
  verifiedAvailability: boolean;
  verifiedRights: boolean;
  verifiedTerms: boolean;
  next: string;
  screeningId: string | null;
  published: boolean;
  joinPath: string | null;
  mailto: string | null;
  requests: EnquiryRequestView[];
};

export type PartyView = {
  id: string;
  userId: string;
  personName: string;
  churchId: string | null;
  churchName: string | null;
  members: number;
  guests: number;
  status: AttendanceStatus;
  proposedMembers: number | null;
  proposedGuests: number | null;
};

export type CinemaView = {
  id: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
};

export type VenueHold = {
  placeId: string;
  cinemaName: string;
  bookingStatus: "pending" | "booked";
  hostChurchName: string;
};

export type EventView = {
  id: string;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  embedUrl: string | null;
  verses: Verse[];
  bookingStatus: BookingStatus;
  screeningMode: RequestMode;
  requestStatus: RequestStatus;
  expectedHeadcount: number;
  startsAt: string;
  timeZone: string;
  capacity: number;
  visibility: Visibility;
  joinPath: string;
  hostChurchId: string;
  hostChurchName: string;
  cinema: CinemaView | null;
  taken: number;
  remaining: number;
  viewerIsHost: boolean;
  viewerPartyId: string | null;
  parties: PartyView[];
};
