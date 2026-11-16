export type Visibility = "private" | "open";

export type BookingStatus = "tbd" | "pending" | "booked";

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
  cinemaId: string | null;
  title: string;
  durationMinutes: number;
  videoUrl: string;
  verses: Verse[];
  bookingStatus: BookingStatus;
  startsAt: string;
  timeZone: string;
  capacity: number;
  visibility: Visibility;
  joinToken: string;
};

export type PartyRecord = {
  id: string;
  eventId: string;
  userId: string;
  churchId: string | null;
  members: number;
  guests: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  churchId: string | null;
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
};

export type PartyView = {
  id: string;
  userId: string;
  personName: string;
  churchId: string | null;
  churchName: string | null;
  members: number;
  guests: number;
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
