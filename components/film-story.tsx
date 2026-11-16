"use client";

import { useEffect, useRef, useState } from "react";
import { FILM_SITE, TRAILER_HLS, TRAILER_POSTER } from "@/lib/chosen";

export function FilmStory() {
  return (
    <section className="space-y-4">
      <div>
        <p className="eyebrow">Season 6 finale</p>
        <h2 className="display mt-2 text-4xl">The last day, in a cinema</h2>
        <p className="mt-3 text-sm leading-relaxed">
          The Chosen Crucifixion follows Jesus through the final day, with the people who love him and the people who condemn him. It closes season 6, and it is meant to be seen together on a big screen.
        </p>
        <p className="muted mt-2 text-sm">In cinemas worldwide in spring 2027. Singapore’s date is still to be confirmed.</p>
      </div>
      <Trailer />
      <a className="link text-sm" href={FILM_SITE} target="_blank" rel="noreferrer">
        Official film page
      </a>
    </section>
  );
}

function Trailer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => hlsRef.current?.destroy();
  }, []);

  async function play() {
    const video = videoRef.current;
    if (!video || playing) return;
    setFailed(false);
    try {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = TRAILER_HLS;
      } else {
        const { default: Hls } = await import("hls.js");
        if (!Hls.isSupported()) throw new Error("This browser cannot play the trailer here.");
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(TRAILER_HLS);
        hls.attachMedia(video);
      }
      setPlaying(true);
      await video.play();
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }

  return (
    <div className="film relative aspect-video">
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-cover"
        poster={TRAILER_POSTER}
        controls={playing}
        playsInline
        preload="none"
        aria-label="The Chosen Crucifixion trailer"
      />
      {playing ? null : (
        <button type="button" className="absolute inset-0 grid place-items-center" onClick={() => void play()}>
          <span className="rounded-full border border-[var(--gold)] bg-black/50 px-4 py-2 text-sm font-semibold">Play the trailer</span>
        </button>
      )}
      {failed ? (
        <p className="absolute inset-x-0 bottom-3 px-3 text-center text-sm">
          The trailer did not start.{" "}
          <a className="link" href={`${FILM_SITE}#watch`} target="_blank" rel="noreferrer">
            Watch it on the film site
          </a>
        </p>
      ) : null}
    </div>
  );
}
