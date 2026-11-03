"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GENRES, type Genre } from "../genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "../genre-vote/prototype-config";
import { createMockGenreResult, createMockRankingResult, GENRE_RANKING_SCENARIOS, MOCK_GENRE_RESULT, type GenreRankingPreviewId } from "./prototype-data";
import { GenreResultScreen } from "./genre-result-screen";
import type { GenreResultData } from "./result-data";
import styles from "./genre-result.module.css";

const PREVIEW_MISSING_IMAGE = "/genres/preview-result-missing.webp";
type PreviewDataState = "normal" | "empty" | "invalid" | "zero";

export function GenreResultPreview() {
  const [genreId, setGenreId] = useState<string>(MOCK_GENRE_RESULT.decidedGenreId);
  const [replayKey, setReplayKey] = useState<number>(0);
  const [missingImage, setMissingImage] = useState<boolean>(false);
  const [dataState, setDataState] = useState<PreviewDataState>("normal");
  const [rankingScenario, setRankingScenario] = useState<"legacy" | GenreRankingPreviewId>("legacy");
  const [selectedGenreId, setSelectedGenreId] = useState<string>("");
  const genres: readonly Genre[] = missingImage ? GENRES.map((genre) => genre.id === genreId ? { ...genre, imagePath: PREVIEW_MISSING_IMAGE } : genre) : GENRES;
  const base = rankingScenario === "legacy" ? createMockGenreResult(genreId, GENRES) : createMockRankingResult(genreId, GENRES, rankingScenario);
  const result: GenreResultData = dataState === "invalid" ? { ...base, decidedGenreId: "preview-unregistered-genre" }
    : dataState === "empty" ? { ...base, rankings: [] }
      : dataState === "zero" ? { ...base, participantCount: 0, decision: undefined, rankings: base.rankings.map((row) => ({ ...row, votes: 0 })) } : base;

  return (
      <GenreResultScreen result={result} genres={genres} roomId={PROTOTYPE_ROOM_ID} isPrototype replayKey={replayKey} onFindShops={setSelectedGenreId}>
      <section className={styles.previewControls} aria-labelledby="genre-result-preview-heading">
        <h2 id="genre-result-preview-heading">結果画面・開発用プレビュー</h2>
        <p>表示する結果を指定した仮データです。投票の集計・店舗検索は行いません。</p>
        <label htmlFor="genre-result-preview-genre">決定ジャンル</label>
        <select id="genre-result-preview-genre" value={genreId} onChange={(event) => { setGenreId(event.target.value); setSelectedGenreId(""); }}>{GENRES.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select>
        <label htmlFor="genre-result-preview-rankings">確定済み順位の表示確認</label>
        <select id="genre-result-preview-rankings" value={rankingScenario} onChange={(event) => {
          const selected = GENRE_RANKING_SCENARIOS.find(item => item.id === event.target.value);
          setRankingScenario(selected?.id ?? "legacy"); setDataState("normal");
        }}><option value="legacy">従来の上位3件</option>{GENRE_RANKING_SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <p>{GENRE_RANKING_SCENARIOS.find(item => item.id === rankingScenario)?.description ?? "従来の上位3件サンプルです。実投票の順位ではありません。"}</p>
        <div className={styles.previewActions}>
          <Button type="button" variant="outline" onClick={() => setReplayKey((current) => current + 1)}>演出をもう一度見る</Button>
          <Button type="button" variant="outline" aria-pressed={missingImage} onClick={() => setMissingImage((current) => !current)}>{missingImage ? "ジャンルデータの画像へ戻す" : "画像読み込み失敗を確認"}</Button>
        </div>
        <div className={styles.previewActions}>
          <Button type="button" variant="soft" onClick={() => setDataState("empty")}>内訳なし</Button>
          <Button type="button" variant="soft" onClick={() => setDataState("zero")}>0票</Button>
          <Button type="button" variant="soft" onClick={() => setDataState("invalid")}>不明なID</Button>
          <Button type="button" variant="outline" onClick={() => setDataState("normal")}>通常データ</Button>
        </div>
        <p role="status" data-selected-genre>引き継いだジャンルID：{selectedGenreId || "未選択"}（店舗選定は未接続）</p>
      </section>
      </GenreResultScreen>
  );
}
