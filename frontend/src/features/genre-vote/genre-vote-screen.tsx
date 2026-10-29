"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { Heart, Undo2, X } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import type { Genre } from "./genres";
import { GenreArtwork } from "./genre-artwork";
import { useGenreVote } from "./use-genre-vote";
import { SWIPE } from "./swipe-config";
import type { VoteChoice } from "./vote-state";
import styles from "./genre-vote.module.css";

type GenreVoteScreenProps = { genres: readonly Genre[]; roomId?: string; onComplete: () => void };
type MotionStyle = CSSProperties & {
  "--drag-x": string;
  "--drag-y": string;
  "--drag-rotation": string;
  "--return-duration": string;
  "--exit-duration": string;
  "--enter-duration": string;
  "--undo-duration": string;
};

export function GenreVoteScreen({ genres, roomId, onComplete }: GenreVoteScreenProps) {
  const { votes, phase, motion, cardRef, vote, undo, finishAnimation, currentGenre, complete, locked, canUndo, pointerHandlers, labelOpacity, lastAction } = useGenreVote(genres);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const resumeFocusRef = useRef<VoteChoice | "undo" | null>(null);
  const completionNotifiedRef = useRef<boolean>(false);
  const total = genres.length;
  const completedCount = votes.length;
  const currentNumber = Math.min(completedCount + 1, total);
  const genre = currentGenre;
  const lastVote = lastAction?.type === "vote" ? lastAction.vote : undefined;
  const lastGenre = lastVote ? genres.find((item) => item.id === lastVote.genreId) : undefined;
  const announcement = complete ? `${total}ジャンルの投票が完了しました。待機画面へ移動します。`
    : lastAction?.type === "undo" ? `${genre?.name}の投票を取り消しました。${currentNumber}件目を選び直せます。`
      : lastVote ? `${lastGenre?.name}を${lastVote.choice === "like" ? "食べたい" : "見送り"}にしました。次は${genre?.name}、${currentNumber}件目です。` : "";
  const motionStyle: MotionStyle = {
    "--drag-x": `${motion.x}px`,
    "--drag-y": `${motion.y}px`,
    "--drag-rotation": `${motion.rotation}deg`,
    "--return-duration": `${SWIPE.returnDuration}ms`,
    "--exit-duration": `${SWIPE.exitDuration}ms`,
    "--enter-duration": `${SWIPE.enterDuration}ms`,
    "--undo-duration": `${SWIPE.undoDuration}ms`,
  };

  useEffect(() => {
    if (!complete) completionNotifiedRef.current = false;
    if (complete && total > 0 && onComplete && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onComplete();
    }
  }, [complete, total, onComplete]);

  useEffect(() => {
    if (complete) {
      resumeFocusRef.current = null;
    } else if (phase === "idle" && resumeFocusRef.current) {
      if (document.activeElement === document.body) {
        const target = resumeFocusRef.current === "undo"
          ? completedCount > 0 ? undoButtonRef : skipButtonRef
          : resumeFocusRef.current === "like" ? likeButtonRef : skipButtonRef;
        target.current?.focus({ preventScroll: true });
      }
      resumeFocusRef.current = null;
    }
  }, [complete, phase, completedCount]);

  function choose(choice: VoteChoice, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) resumeFocusRef.current = choice;
    vote(choice);
  }

  function rewind(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) resumeFocusRef.current = "undo";
    undo();
  }

  return (
    <div className={styles.background}>
      <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />}>
        <StepProgress currentStep="genre" />
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

        {total === 0 ? (
          <section className={`meal-card ${styles.empty}`}><h1 className="text-xl">投票できるジャンルがありません</h1><p className={styles.description}>ジャンル一覧を用意してから、もう一度開いてください。</p></section>
        ) : complete ? (
          <p className={styles.handoff}>みんなの投票状況を開いています…</p>
        ) : genre ? (
          <>
            <div className={styles.titleRow}>
              <div><p className={styles.kicker}>ジャンル投票</p><h1>今日は何<span className={styles.titleEnding}>食べたい？</span></h1></div>
              <div className={styles.voteProgress}>
                <span aria-label={`現在のカード ${currentNumber} / ${total}`}>{currentNumber} / {total}</span>
                <div className={styles.progressTrack} role="progressbar" aria-label="ジャンル投票済み件数" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completedCount}>
                  <span style={{ width: `${completedCount / total * 100}%` }} />
                </div>
                <small>投票済み {completedCount}件</small>
              </div>
            </div>
            <div className={styles.swipeWindow}>
              <div className={styles.cardStage} data-phase={phase} style={motionStyle}>
                <div className={styles.backCard} aria-hidden="true" />
                <article
                  key={genre.id}
                  ref={cardRef}
                  className={styles.genreCard}
                  aria-labelledby="genre-card-title"
                  aria-describedby="genre-swipe-help"
                  data-genre-id={genre.id}
                  {...pointerHandlers}
                  onTransitionEnd={(event) => {
                    if (event.target === event.currentTarget && event.propertyName === "transform") finishAnimation();
                  }}
                  onAnimationEnd={(event) => {
                    if (event.target === event.currentTarget) finishAnimation();
                  }}
                >
                  <GenreArtwork genre={genre} />
                  <div className={`${styles.directionLabel} ${styles.likeLabel}`} data-vote-choice="like" aria-hidden="true" style={{ opacity: motion.x > 0 ? labelOpacity : 0 }}><Heart />食べたい</div>
                  <div className={`${styles.directionLabel} ${styles.skipLabel}`} data-vote-choice="skip" aria-hidden="true" style={{ opacity: motion.x < 0 ? labelOpacity : 0 }}><X />見送り</div>
                </article>
              </div>
            </div>

            <div id="genre-swipe-help" className={styles.swipeHelp}><span>← 見送り</span><span>食べたい →</span></div>
            <p className={styles.swipeHint}>左右にスワイプ、またはボタンで選べます</p>
            <BottomAction className={styles.actions}>
              <div className={styles.actionGroup}>
                <div className={styles.actionItem}>
                  <Button ref={skipButtonRef} type="button" variant="outline" size="icon-lg" className={`${styles.actionButton} ${styles.skipButton}`} disabled={locked} aria-label={`${genre.name}を見送り`} onClick={(event) => choose("skip", event)}><X aria-hidden="true" /></Button>
                  <span aria-hidden="true">見送り</span>
                </div>
                <Button ref={undoButtonRef} type="button" variant="ghost" className={styles.undoButton} disabled={!canUndo} aria-label="直前の投票を取り消して戻る" onClick={rewind}><Undo2 aria-hidden="true" /><span>戻る</span></Button>
                <div className={`${styles.actionItem} ${styles.likeAction}`}>
                  <Button ref={likeButtonRef} type="button" variant="primary" size="icon-lg" className={styles.actionButton} disabled={locked} aria-label={`${genre.name}を食べたい`} onClick={(event) => choose("like", event)}><Heart fill="currentColor" aria-hidden="true" /></Button>
                  <span aria-hidden="true">食べたい</span>
                </div>
              </div>
            </BottomAction>
          </>
        ) : null}
      </PageContainer>
    </div>
  );
}
