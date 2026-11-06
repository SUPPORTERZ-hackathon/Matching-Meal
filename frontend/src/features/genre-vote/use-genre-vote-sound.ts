
"use client";

import { useCallback, useEffect, useRef } from "react";

export function useGenreVoteSound() {
  const voteAudioRef = useRef<HTMLAudioElement | null>(null);
  const undoAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const voteAudio = new Audio("/audio/genre-vote.mp3");
    const undoAudio = new Audio("/audio/genre-undo.mp3");

    voteAudio.preload = "auto";
    undoAudio.preload = "auto";

    voteAudioRef.current = voteAudio;
    undoAudioRef.current = undoAudio;

    return () => {
      voteAudio.pause();
      undoAudio.pause();
      voteAudioRef.current = null;
      undoAudioRef.current = null;
    };
  }, []);

  const playVoteSound = useCallback(() => {
    let audio = voteAudioRef.current;

    if (!audio) {
      audio = new Audio("/audio/genre-vote.mp3");
      voteAudioRef.current = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.error("投票SEの再生に失敗しました:", error);
    });
  }, []);

  const playUndoSound = useCallback(() => {
    let audio = undoAudioRef.current;

    if (!audio) {
      audio = new Audio("/audio/genre-undo.mp3");
      undoAudioRef.current = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.error("戻すSEの再生に失敗しました:", error);
    });
  }, []);

  return { playVoteSound, playUndoSound };
}
