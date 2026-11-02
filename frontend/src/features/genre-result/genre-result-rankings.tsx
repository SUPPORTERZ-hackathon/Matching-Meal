import { GENRE_RANKING_LIMIT, getVotePercentage, topGenreRankings, type ResolvedGenreVoteSummary } from "./result-data";
import styles from "./genre-result.module.css";

export type GenreResultRankingsProps = {
  rankings: readonly ResolvedGenreVoteSummary[];
  participantCount: number;
  tieBreakApplied?: boolean;
};

export function GenreResultRankings({ rankings, participantCount, tieBreakApplied = false }: GenreResultRankingsProps) {
  const rows = topGenreRankings(rankings);
  if (rows.length === 0) return null;
  return <>
    <ol className={styles.rankings} aria-label={`ジャンル投票の上位${GENRE_RANKING_LIMIT}位`} data-genre-rankings>
      {rows.map((row, index) => <li key={row.genre.id} className={styles.rank} data-genre-rank={index + 1} data-ranked-genre={row.genre.id}>
        <span className={styles.rankNumber} aria-hidden="true">{index + 1}</span>
        <div className={styles.rankDetail}><p><span className="sr-only">{index + 1}位 </span><strong>{row.genre.name}</strong><b>{row.votes}票</b></p>
          <div className={styles.rankTrack} role="progressbar" aria-label={`${row.genre.name}の投票数`} aria-valuemin={0} aria-valuemax={participantCount || 1} aria-valuenow={row.votes} aria-valuetext={`${participantCount}人中${row.votes}票`}><span style={{ width: `${getVotePercentage(row.votes, participantCount)}%` }} /></div>
        </div>
      </li>)}
    </ol>
    {tieBreakApplied && <p className={styles.emptyRanking} data-ranking-tie-note>同票の順位は抽選で決定しています。</p>}
  </>;
}
