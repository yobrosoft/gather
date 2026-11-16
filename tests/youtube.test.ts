import { describe, expect, it } from "vitest";
import { youtubeEmbedUrl, youtubeVideoId } from "@/lib/youtube";

describe("youtube preview links", () => {
  it("accepts watch, share, and embed links", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=abcdefghijk&t=12")).toBe("abcdefghijk");
    expect(youtubeVideoId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeEmbedUrl("https://www.youtube.com/shorts/abcdefghijk")).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
  });

  it("rejects other sites", () => {
    expect(youtubeVideoId("https://vimeo.com/abcdefghijk")).toBeNull();
    expect(youtubeVideoId("not a url")).toBeNull();
  });
});
