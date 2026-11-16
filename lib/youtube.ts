const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let id = "";
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") id = parts[1] ?? "";
    }
  }
  id = id.split("?")[0] ?? "";
  return VIDEO_ID.test(id) ? id : null;
}

export function youtubeWatchUrl(input: string): string | null {
  const id = youtubeVideoId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export function youtubeEmbedUrl(input: string): string | null {
  const id = youtubeVideoId(input);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
