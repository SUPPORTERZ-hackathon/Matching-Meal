import type { ReactNode } from "react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { StepProgress } from "@/components/common/step-progress";
import type { Genre } from "../genre-vote/genres";
import { getVotePercentage, resolveGenreResult, type GenreResultData } from "./result-data";
import { ResultReveal } from "./result-reveal";
import { ResultBottomAction } from "./result-bottom-action";
import styles from "./genre-result.module.css";

export type GenreResultScreenProps = {
  result: GenreResultData;
  genres: readonly Genre[];
  roomId?: string;
  isPrototype?: boolean;
  replayKey?: number;
  onFindShops?: (genreId: string) => void;
  children?: ReactNode;
};

export function GenreResultScreen({ result, genres, roomId, isPrototype = false, replayKey = 0, onFindShops, children }: GenreResultScreenProps) {
  const view = resolveGenreResult(result, genres);
  return (
    <div className={styles.background}>
      <PageContainer className={styles.page} header={<AppHeader roomNumber={roomId} className={styles.header} />} bottomAction={view ? <ResultBottomAction key={view.genre.id} genre={view.genre} onFindShops={onFindShops} /> : undefined}>
        <StepProgress currentStep="genre" />
        <div className={styles.content}>
          {view ? <>
            <section className={styles.hero} aria-labelledby="genre-result-heading">
              <p className={styles.kicker}>みんなの気分がマッチ！</p>
              <h1 id="genre-result-heading">今日のごはんは…</h1>
              <ResultReveal key={`${view.genre.id}:${replayKey}`} genre={view.genre} />
              <h2 className={styles.genreName} data-decided-genre={view.genre.id}>{view.genre.name}</h2>
              <p className={styles.decidedMessage}>に決まりました！</p>
            </section>
            <section className={`meal-card ${styles.rankingCard}`} aria-labelledby="genre-result-ranking">
              <h2 id="genre-result-ranking">投票結果</h2>
              {view.rankings.length === 0 ? <p className={styles.emptyRanking}>投票の内訳はまだありません</p> : <ol className={styles.rankings}>
                {view.rankings.map((row, index) => <li key={row.genre.id} className={styles.rank}>
                  <span className={styles.rankNumber} aria-hidden="true">{index + 1}</span>
                  <div className={styles.rankDetail}><p><span className="sr-only">{index + 1}位 </span><strong>{row.genre.name}</strong><b>{row.votes}票</b></p>
                    <div className={styles.rankTrack} role="progressbar" aria-label={`${row.genre.name}の投票数`} aria-valuemin={0} aria-valuemax={view.participantCount || 1} aria-valuenow={row.votes} aria-valuetext={`${view.participantCount}人中${row.votes}票`}><span style={{ width: `${getVotePercentage(row.votes, view.participantCount)}%` }} /></div>
                  </div>
                </li>)}
              </ol>}
            </section>
            {isPrototype && <p className={styles.prototypeNote} data-prototype-note>サンプル結果・実際の集計ではありません</p>}
          </> : <section className={`meal-card ${styles.invalid}`} role="status"><h1>結果を表示できません</h1><p>ジャンルと投票結果のデータを確認してください。</p></section>}
          {children}
        </div>
      </PageContainer>
    </div>
  );
}
