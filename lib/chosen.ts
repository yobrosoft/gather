export const CRUCIFIXION_TITLE = "The Chosen Crucifixion";
export const FILM_SITE = "https://thechosencrucifixion.com";
export const TRAILER_HLS = "https://cdn.thechosen.media/videos/cmv8fspf1001xu2wiu77w5mxp/master.m3u8";
export const TRAILER_POSTER = "https://cdn.thechosen.media/videos/cmv8fspf1001xu2wiu77w5mxp/thumbnail.jpg";

export const AUDITORIUM_SEATS = 80;

export function chosenSgEmails(): string[] {
  return (process.env.CHOSEN_SG_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isChosenSg(email: string): boolean {
  return chosenSgEmails().includes(email.trim().toLowerCase());
}
