"use client";

import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { GenreVotePrototype } from "../genre-vote/genre-vote-prototype";
import type { Genre } from "../genre-vote/genres";
import { roomWaitingUrl } from "./room-data";
import { useRoomState } from "./use-room-state";
import styles from "./room-waiting.module.css";

type RoomGenreEntryProps = { roomId?: string; genres: readonly Genre[] };
export function RoomGenreEntry({ roomId, genres }: RoomGenreEntryProps) {
  // 入口だけを実ルームへ接続する。投票中は既存プロトタイプの状態を維持する。
  const { view, retry } = useRoomState(roomId, false);
  if (view.kind === "ready" && view.snapshot.room.status === "genre_voting") {
    return <GenreVotePrototype genres={genres} roomId={view.snapshot.room.joinCode} />;
  }
  return <PageContainer className={styles.page} header={<AppHeader roomNumber={view.kind === "ready" ? view.snapshot.room.joinCode : undefined} />}><section className={styles.message} role="status"><h1>{view.kind === "loading" ? "ルームを確認しています" : "投票画面を開けません"}</h1><p>{view.kind === "error" ? view.error.message : view.kind === "ready" ? "まだ投票が開始されていないか、すでに次のステップへ進んでいます。" : "参加情報を取得しています。"}</p>{view.kind === "error" && <Button type="button" variant="outline" onClick={retry}>もう一度確認する</Button>}<Link href={roomId ? roomWaitingUrl(roomId) : "/home-preview"}>待機画面に戻る</Link></section></PageContainer>;
}
