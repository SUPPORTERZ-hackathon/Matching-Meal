"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GENRE_VOTE_WAITING_PATH } from "@/features/genre-vote-waiting/prototype-data";
import { GenreVoteScreen } from "./genre-vote-screen";
import type { Genre } from "./genres";
import { demoFlowUrl } from "../ui-flow/development-demo";
import { DevelopmentDemoNotice } from "../ui-flow/flow-message";

type GenreVotePrototypeProps = { genres: readonly Genre[]; roomId: string };

export function GenreVotePrototype({ genres, roomId }: GenreVotePrototypeProps) {
  const router = useRouter();
  const showWaiting = useCallback(() => router.replace(demoFlowUrl(GENRE_VOTE_WAITING_PATH)), [router]);
  return <GenreVoteScreen genres={genres} roomId={roomId} onComplete={showWaiting} notice={<DevelopmentDemoNotice />} />;
}
