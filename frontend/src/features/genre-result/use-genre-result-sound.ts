
"use client";

import { useAudio } from "../audio/audio-provider";

export function useGenreResultSound() {
  const { playGenreResult, ready } = useAudio();
  return { playSound: playGenreResult, ready };
}
