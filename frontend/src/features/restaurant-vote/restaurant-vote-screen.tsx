"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { Heart, MapPin, JapaneseYen, X } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import type { Genre } from "../genre-vote/genres";
import type { RestaurantCandidate } from "./restaurant-data";
import type { RestaurantVote, RestaurantVoteChoice } from "./vote-state";
import { useRestaurantVote } from "./use-restaurant-vote";
import { RESTAURANT_VOTE_MOTION } from "./vote-config";
import { RestaurantPhoto } from "./restaurant-photo";
import { RestaurantDetails } from "./restaurant-details";
import styles from "./restaurant-vote.module.css";

type RestaurantVoteScreenProps = {
  genre?: Genre;
  restaurants: readonly RestaurantCandidate[];
  roomId?: string;
  onComplete: (votes: readonly RestaurantVote[]) => void;
};
type MotionStyle = CSSProperties & { "--restaurant-exit-duration": string; "--restaurant-enter-duration": string };

export function RestaurantVoteScreen({ genre, restaurants, roomId, onComplete }: RestaurantVoteScreenProps) {
  const { votes, phase, vote, finishAnimation, currentRestaurant: restaurant, complete, locked, valid } = useRestaurantVote(restaurants);
  const skipRef = useRef<HTMLButtonElement>(null);
  const likeRef = useRef<HTMLButtonElement>(null);
  const resumeFocus = useRef<RestaurantVoteChoice | null>(null);
  const notified = useRef<boolean>(false);
  const total = restaurants.length;
  const currentNumber = Math.min(votes.length + 1, total);
  const lastVote = votes.at(-1);
  const previousName = lastVote ? restaurants.find((item) => item.id === lastVote.restaurantId)?.name : undefined;
  const announcement = complete ? "すべての店舗への投票が完了しました。"
    : lastVote ? `${previousName}を${lastVote.choice === "like" ? "ここがいい" : "見送り"}にしました。次は${restaurant?.name}、${currentNumber}件目です。` : "";
  const motionStyle: MotionStyle = {
    "--restaurant-exit-duration": `${RESTAURANT_VOTE_MOTION.exitDuration}ms`,
    "--restaurant-enter-duration": `${RESTAURANT_VOTE_MOTION.enterDuration}ms`,
  };

  useEffect(() => {
    if (complete && !notified.current) { notified.current = true; onComplete(votes); }
  }, [complete, onComplete, votes]);

  useEffect(() => {
    if (phase === "idle" && resumeFocus.current) {
      if (document.activeElement === document.body) (resumeFocus.current === "like" ? likeRef : skipRef).current?.focus({ preventScroll: true });
      resumeFocus.current = null;
    }
  }, [phase]);

  function choose(choice: RestaurantVoteChoice, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) resumeFocus.current = choice;
    vote(choice);
  }

  return <div className={styles.background}>
    <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />}>
      <StepProgress currentStep="shop" />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      <div className={styles.content}>
        {!genre || !valid || total === 0 ? <section className={`meal-card ${styles.empty}`} role="status">
          <h1>{!genre ? "ジャンルを確認できません" : !valid ? "店舗情報を確認できません" : "投票できるお店がありません"}</h1>
          <p>{!genre ? "ジャンル結果からもう一度開いてください。" : !valid ? "候補のIDや店舗名を確認してください。" : "店舗候補が用意されるまでお待ちください。"}</p>
        </section> : complete ? <p className={styles.handoff}>すべての店舗に投票しました。投票状況を開いています…</p> : restaurant ? <>
          <div className={styles.titleRow}>
            <div><p className={styles.kicker}>お店投票</p><h1>どのお店にする？</h1></div>
            <div className={styles.voteProgress}>
              <span aria-label={`現在の店舗 ${currentNumber} / ${total}`}>{currentNumber} / {total}</span>
              <div className={styles.progressTrack} role="progressbar" aria-label="店舗投票済み件数" aria-valuemin={0} aria-valuemax={total} aria-valuenow={votes.length}><span style={{ width: `${votes.length / total * 100}%` }} /></div>
              <small>投票済み {votes.length}件</small>
            </div>
          </div>
          <article key={restaurant.id} className={styles.restaurantCard} data-restaurant-id={restaurant.id} data-phase={phase} style={motionStyle} aria-labelledby="restaurant-name" onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) finishAnimation(phase);
          }}>
            <RestaurantPhoto key={`${restaurant.id}:${restaurant.photoUrl ?? ""}`} restaurant={restaurant} />
            <div className={styles.cardContent}>
              <span className={styles.genreChip}>{genre.name}</span>
              <h2 id="restaurant-name">{restaurant.name}</h2>
              <dl className={styles.hours}>
                <div><dt>営業時間</dt><dd>{restaurant.openingHours?.trim() || "営業時間情報なし"}</dd></div>
                <div><dt>定休日</dt><dd>{restaurant.closedDays?.trim() || "定休日情報なし"}</dd></div>
              </dl>
              <div className={styles.infoGrid}>
                <div className={styles.infoBox}><MapPin aria-hidden="true" /><div><p>最寄駅</p><strong>{restaurant.stationName?.trim() || "最寄駅情報なし"}</strong></div></div>
                <div className={styles.infoBox}><JapaneseYen aria-hidden="true" /><div><p>ディナー予算</p><strong>{restaurant.dinnerBudget?.trim() || "ディナー予算情報なし"}</strong></div></div>
              </div>
              <p className={styles.access}>{restaurant.access?.trim() || "アクセス情報なし"}</p>
            </div>
          </article>
          <BottomAction className={styles.actions}>
            <div className={styles.actionGroup}>
              <div className={styles.actionItem}><Button ref={skipRef} type="button" variant="outline" size="icon-lg" className={`${styles.actionButton} ${styles.skipButton}`} disabled={locked} aria-label={`${restaurant.name}を見送り`} data-restaurant-choice="skip" onClick={(event) => choose("skip", event)}><X aria-hidden="true" /></Button><span aria-hidden="true">見送り</span></div>
              <div className={`${styles.actionItem} ${styles.likeAction}`}><Button ref={likeRef} type="button" variant="primary" size="icon-lg" className={styles.actionButton} disabled={locked} aria-label={`${restaurant.name}に投票（ここがいい）`} data-restaurant-choice="like" onClick={(event) => choose("like", event)}><Heart fill="currentColor" aria-hidden="true" /></Button><span aria-hidden="true">ここが<wbr />いい</span></div>
            </div>
          </BottomAction>
          <RestaurantDetails restaurant={restaurant} />
        </> : null}
      </div>
    </PageContainer>
  </div>;
}
