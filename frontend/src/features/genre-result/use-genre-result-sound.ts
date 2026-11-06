
"use client";

import { useCallback, useEffect, useRef } from "react";

export function useGenreResultSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/audio/genre-result.mp3");
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      audio.pause();
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) return;

    audio.currentTime = 0;
    void audio.play().catch((error) => {
        if (error.name === "AbortError") return;

      console.error("ジャンル決定SEの再生に失敗しました:", error);
    });
  }, []);

  return { playSound };
}
