import type { ReactNode } from "react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import type { Genre } from "../genre-vote/genres";
import { DECISION_LABELS, resolveGenreResult, type GenreResultData } from "./result-data";
import { GenreResultRankings } from "./genre-result-rankings";
import { ResultReveal } from "./result-reveal";
import { ResultBottomAction } from "./result-bottom-action";
import styles from "./genre-result.module.css";
import { useEffect } from "react";
import { useGenreResultSound } from "./use-genre-result-sound";

export type GenreResultScreenProps = {
  result: GenreResultData;
  genres: readonly Genre[];
  roomId?: string;
  isPrototype?: boolean;
  replayKey?: number;
  onFindShops?: (genreId: string) => void;
  bottomAction?: ReactNode;
  children?: ReactNode;
};

export function GenreResultScreen({
  result,
  genres,
  roomId,
  isPrototype = false,
  replayKey = 0,
  onFindShops,
  bottomAction,
  children,
}: GenreResultScreenProps) {
  const { playSound } = useGenreResultSound();

  const view = resolveGenreResult(result, genres);
  useEffect(() => {
    if (!view) return;

    playSound();
  }, [view?.genre.id, replayKey, playSound]);
  return (
    <div className={styles.background}>
      <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />} bottomAction={view ? bottomAction ?? <ResultBottomAction key={view.genre.id} genre={view.genre} onFindShops={onFindShops} /> : undefined}>
        <StepProgress currentStep="genre" />
        <div className={styles.content}>
          {view ? <>
            <section className={styles.hero} aria-labelledby="genre-result-heading">
              <p className={styles.kicker}>みんなの気分がマッチ！</p>
              <h1 id="genre-result-heading">今日のごはんは…</h1>
              <ResultReveal key={`${view.genre.id}:${view.genre.imagePath ?? "none"}:${replayKey}`} genre={view.genre} />
              <h2 className={styles.genreName} data-decided-genre={view.genre.id}>{view.genre.name}</h2>
              <p className={styles.decidedMessage}>に決まりました！</p>
            </section>
            <section className={`meal-card ${styles.rankingCard}`} aria-labelledby="genre-result-ranking">
              <h2 id="genre-result-ranking">投票結果</h2>
              {view.decision && <div className={styles.emptyRanking} data-api-result-summary>
                <p>{view.participantCount}人中{view.decision.likeCount}人が「食べたい」</p>
                <p>決定方法：{DECISION_LABELS[view.decision.decisionMethod]}</p>
              </div>}
              {view.rankings.length > 0 ? <GenreResultRankings rankings={view.rankings} participantCount={view.participantCount} tieBreakApplied={view.rankingTieBreakApplied} />
                : !view.decision && <p className={styles.emptyRanking}>投票の内訳はまだありません</p>}
            </section>
            {isPrototype && <p className={styles.prototypeNote} data-prototype-note>サンプル結果・実際の集計ではありません</p>}
          </> : <section className={`meal-card ${styles.invalid}`} role="status"><h1>結果を表示できません</h1><p>ジャンルと投票結果のデータを確認してください。</p></section>}
          {children}
        </div>
      </PageContainer>
    </div>
  );
}
