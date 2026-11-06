"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { RestaurantVoteWaitingScreen } from "../restaurant-vote-waiting/restaurant-vote-waiting-screen";
import { RestaurantResultScreen } from "../restaurant-result/restaurant-result-screen";
import { clearRestaurantDraft } from "./restaurant-draft";
import { restaurantResultPresentation, restaurantVotingStage, restaurantVotingUrl, waitingRestaurantParticipants, type RestaurantVotingStage } from "./restaurant-voting-data";
import { useRestaurantVoting } from "./use-restaurant-voting";
import { RoomRestaurantVote } from "./room-restaurant-vote";
import styles from "../genre-voting-api/genre-api.module.css";

type RestaurantVotingEntryProps = { roomId?: string; screen: RestaurantVotingStage };
export function RestaurantVotingEntry({ roomId, screen }: RestaurantVotingEntryProps) {
  const router = useRouter(), { view, retry } = useRestaurantVoting(roomId, screen !== "vote");
  const target = view.kind === "ready" ? restaurantVotingStage(view.voting) : undefined;
  useEffect(() => {
    if (view.kind !== "ready") return;
    if (view.voting.submitted) clearRestaurantDraft(view.session);
    if (target && target !== screen) router.replace(restaurantVotingUrl(target, view.voting.room.id));
  }, [view, target, screen, router]);
  const saved = useCallback(() => { if (roomId) router.replace(restaurantVotingUrl("waiting", roomId)); }, [roomId, router]);
  const roomNumber = view.kind === "ready" ? view.voting.room.joinCode : undefined;
  if (view.kind !== "ready" || target !== screen) return <PageContainer className={styles.page} header={<AppHeader roomNumber={roomNumber} />}><StepProgress currentStep="shop" />
    <section className={styles.content} role={view.kind === "error" ? "alert" : "status"}><h1>{view.kind === "error" ? "店舗情報を確認できません" : "店舗を準備しています"}</h1>
      <p>{view.kind === "error" ? view.error.message : "候補店舗と投票状況を確認しています。"}</p>
      {view.kind === "error" && <Button type="button" variant="outline" onClick={retry}>候補を再確認して再試行する</Button>}<Link href="/home-preview">ホームに戻る</Link>
    </section></PageContainer>;
  const stale = view.staleError ? <div className={styles.error} role="alert"><p>{view.staleError.message} 最後に取得した投票状況を表示しています。</p><Button type="button" variant="outline" onClick={retry}>再取得する</Button></div> : undefined;
  if (screen === "vote") return <RoomRestaurantVote key={view.session.participant.id} session={view.session} candidates={view.candidates} onSaved={saved} notice={stale} />;
  if (screen === "waiting") return <RestaurantVoteWaitingScreen participants={waitingRestaurantParticipants(view.voting)} roomId={roomNumber}>{stale}</RestaurantVoteWaitingScreen>;
  const result = restaurantResultPresentation(view.voting, view.candidates);
  const restaurant = view.voting.result?.restaurant;
  return result && restaurant ? <RestaurantResultScreen result={result} genres={GENRES} restaurants={[restaurant]} roomId={roomNumber}>{stale}</RestaurantResultScreen> : null;
}
