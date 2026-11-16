import type { BookingStatus, RequestMode, RequestStatus } from "@/lib/types";

export function localDateKey(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours} hr ${rest} min`;
  if (hours > 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${rest} min`;
}

export function requestModeLabel(mode: RequestMode): string {
  return mode === "shared" ? "Shared screening" : "Private screening";
}

export function requestStatusLabel(status: RequestStatus): string {
  if (status === "accepted") return "Cinema said yes";
  if (status === "declined") return "Cinema said no";
  if (status === "needs_partner") return "Needs another church";
  return "Waiting on the cinema";
}

export function bookingLabel(status: BookingStatus): string {
  if (status === "pending") return "Pending booking";
  if (status === "booked") return "Booked";
  return "TBD";
}

export function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
}

export function peopleLabel(members: number, guests: number): string {
  const memberText = members === 1 ? "1 member" : `${members} members`;
  const guestText = guests === 1 ? "1 guest" : `${guests} guests`;
  if (members > 0 && guests > 0) return `${memberText}, ${guestText}`;
  if (members > 0) return memberText;
  return guestText;
}

export function nextSaturdayEveningValue(now = new Date()): string {
  const date = new Date(now);
  const add = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + add);
  date.setHours(19, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
