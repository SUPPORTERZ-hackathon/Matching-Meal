import type { Genre } from "../genre-vote/genres";
import type { GenreDecision, GenreResultData } from "./result-data";

export const GENRE_RESULT_PATH = "/genre-result";

// 表示用の仮データ。参加者の実投票を集計した結果ではない。
export const MOCK_GENRE_RESULT: GenreResultData = {
  decidedGenreId: "ramen",
  participantCount: 3,
  rankings: [
    { genreId: "ramen", votes: 3 },
    { genreId: "yakiniku", votes: 2 },
    { genreId: "sushi-seafood", votes: 1 },
  ],
};

// 開発プレビューで指定されたジャンルを発表するだけで、集計ルールではない。
export function createMockGenreResult(genreId: string, genres: readonly Genre[]): GenreResultData {
  const MOCK_OTHER_VOTES = [2, 1] as const;
  const others = genres.filter((genre) => genre.id !== genreId).slice(0, MOCK_OTHER_VOTES.length);
  return {
    ...MOCK_GENRE_RESULT,
    decidedGenreId: genreId,
    rankings: [
      { genreId, votes: MOCK_GENRE_RESULT.participantCount },
      ...others.map((genre, index) => ({ genreId: genre.id, votes: MOCK_OTHER_VOTES[index] })),
    ],
  };
}

export type GenreRankingPreviewId = "different" | "winner-tie" | "lower-tie" | "boundary-tie" | "all-tied" | "all-zero" | "unavailable";
type RankingPreviewScenario = {
  id: GenreRankingPreviewId; label: string; description: string; participantCount: number;
  votes: readonly number[]; method: GenreDecision["decisionMethod"]; tieBreakApplied: boolean;
};
export const GENRE_RANKING_SCENARIOS: readonly RankingPreviewScenario[] = [
  { id: "different", label: "異なる票数", description: "確定済みの異なる票数を表示する仮データです。", participantCount: 5, votes: [5, 3, 1], method: "most_likes", tieBreakApplied: false },
  { id: "winner-tie", label: "1位が同票", description: "同票の中から供給元が選んだジャンルを1位にした仮データです。", participantCount: 5, votes: [4, 4, 2], method: "random_tie", tieBreakApplied: true },
  { id: "lower-tie", label: "2・3位が同票", description: "2・3位の抽選済み順序を模した固定の仮データです。", participantCount: 5, votes: [5, 3, 3], method: "most_likes", tieBreakApplied: true },
  { id: "boundary-tie", label: "3位境界の同票", description: "表示外にも同票候補があり、3位が抽選済みという想定の仮データです。候補の集計・抽選はしません。", participantCount: 6, votes: [6, 4, 2], method: "most_likes", tieBreakApplied: true },
  { id: "all-tied", label: "上位3件が同票", description: "決定ジャンルを先頭にした抽選済み順序の仮データです。", participantCount: 5, votes: [4, 4, 4], method: "random_tie", tieBreakApplied: true },
  { id: "all-zero", label: "全16ジャンルが0票", description: "全件0票から供給元が確定した、重複しない上位3件を模した仮データです。", participantCount: 3, votes: [0, 0, 0], method: "random_all_skipped", tieBreakApplied: true },
  { id: "unavailable", label: "実API相当・順位なし", description: "現在のR6と同じく、決定ジャンルの票数・方法だけを表示する仮データです。", participantCount: 3, votes: [], method: "most_likes", tieBreakApplied: false },
];
const MOCK_DECIDED_AT = "2026-11-01T00:00:00Z";

// 表示用の確定順サンプル。実際の集計や抽選、実APIの拡張ではない。
export function createMockRankingResult(genreId: string, genres: readonly Genre[], scenarioId: GenreRankingPreviewId): GenreResultData {
  const base = createMockGenreResult(genreId, genres);
  const scenario = GENRE_RANKING_SCENARIOS.find(item => item.id === scenarioId)!;
  return { ...base, participantCount: scenario.participantCount,
    rankings: base.rankings.slice(0, scenario.votes.length).map((row, index) => ({ ...row, votes: scenario.votes[index] })),
    decision: { likeCount: scenario.votes[0] ?? scenario.participantCount, decisionMethod: scenario.method, decidedAt: MOCK_DECIDED_AT },
    rankingTieBreakApplied: scenario.tieBreakApplied };
}
