
"use client";

import { useAudio } from "../audio/audio-provider";

export function useGenreVoteSound() {
  const { playSe } = useAudio();
  return {
    playVoteSound: () => { void playSe("genre-vote"); },
    playUndoSound: () => { void playSe("genre-undo"); },
  };
}
