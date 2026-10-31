"use client";

import Link from "next/link";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { FlowMessage } from "../ui-flow/flow-message";
import { useRoomState } from "./use-room-state";
import styles from "./room-waiting.module.css";

type RoomGenreEntryProps = { roomId?: string };
export function RoomGenreEntry({ roomId }: RoomGenreEntryProps) {
  // 実ルームを確認するが、未接続の投票をモックの結果へ進めない。
  const { view, retry } = useRoomState(roomId, false);
  if (view.kind === "ready" && view.snapshot.room.status === "genre_voting") {
    return <FlowMessage step="genre" roomNumber={view.snapshot.room.joinCode} title="ジャンル投票は準備中です" description="ルームの投票開始は完了しました。ジャンル投票の保存・同期はまだ接続されていないため、正式な投票や結果表示はここから先へ進めません。" />;
  }
  return <PageContainer className={styles.page} header={<AppHeader roomNumber={view.kind === "ready" ? view.snapshot.room.joinCode : undefined} />}><section className={styles.message} role="status"><h1>{view.kind === "loading" ? "ルームを確認しています" : "投票画面を開けません"}</h1><p>{view.kind === "error" ? view.error.message : view.kind === "ready" ? "まだ投票が開始されていないか、すでに次のステップへ進んでいます。" : "参加情報を取得しています。"}</p>{view.kind === "error" && <Button type="button" variant="outline" onClick={retry}>もう一度確認する</Button>}<Link href="/home-preview">ホームに戻る</Link></section></PageContainer>;
}
