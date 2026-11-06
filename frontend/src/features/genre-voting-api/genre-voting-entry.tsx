"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { GenreVoteWaitingScreen } from "../genre-vote-waiting/genre-vote-waiting-screen";
import { GenreResultScreen } from "../genre-result/genre-result-screen";
import { clearGenreDraft } from "./genre-draft";
import { genreVotingStage, genreVotingUrl, resultPresentation, waitingParticipants, type GenreVotingStage } from "./genre-voting-data";
import { useGenreVoting } from "./use-genre-voting";
import { RoomGenreVote } from "./room-genre-vote";
import styles from "./genre-api.module.css";

type GenreVotingEntryProps = { roomId?: string; screen: Exclude<GenreVotingStage, "lobby"> };
export function GenreVotingEntry({ roomId, screen }: GenreVotingEntryProps) {
  const router = useRouter();
  const { view, retry } = useGenreVoting(roomId, screen !== "vote");
  const target = view.kind === "ready" ? genreVotingStage(view.snapshot) : undefined;
  useEffect(() => {
    if (view.kind !== "ready") return;
    if (view.snapshot.submitted) clearGenreDraft(view.session);
    if (target && target !== screen) router.replace(genreVotingUrl(target, view.snapshot.room.id));
  }, [view, target, screen, router]);
  const saved = useCallback(() => { if (roomId) router.replace(genreVotingUrl("waiting", roomId)); }, [roomId, router]);
  const findShops = useCallback(() => { if (roomId) router.push(`/restaurant-vote?room=${encodeURIComponent(roomId)}`); }, [roomId, router]);
  const roomNumber = view.kind === "ready" ? view.snapshot.room.joinCode : undefined;
  if (view.kind !== "ready" || target !== screen) return <PageContainer className={styles.page} header={<AppHeader roomNumber={roomNumber} />}><StepProgress currentStep="genre" />
    <section className={styles.content} role={view.kind === "error" ? "alert" : "status"}><h1>{view.kind === "error" ? "投票情報を確認できません" : "投票状況を確認しています"}</h1>
      <p>{view.kind === "error" ? view.error.message : "ルームとあなたの提出状況を確認しています。"}</p>
      {view.kind === "error" && <Button type="button" variant="outline" onClick={retry}>もう一度確認する</Button>}<Link href="/home-preview">ホームに戻る</Link>
    </section></PageContainer>;
  if (screen === "vote") return <RoomGenreVote key={view.session.participant.id} session={view.session} onSaved={saved} />;
  const stale = view.staleError ? <div className={styles.error} role="alert"><p>{view.staleError.message} 最後に取得した投票状況を表示しています。</p><Button type="button" variant="outline" onClick={retry}>再取得する</Button></div> : undefined;
  if (screen === "waiting") return <GenreVoteWaitingScreen participants={waitingParticipants(view.snapshot)} roomId={roomNumber}>{stale}</GenreVoteWaitingScreen>;
  const result = resultPresentation(view.snapshot);
  return result ? <GenreResultScreen result={result} genres={GENRES} roomId={roomNumber} onFindShops={findShops}>{stale}</GenreResultScreen> : null;
}
