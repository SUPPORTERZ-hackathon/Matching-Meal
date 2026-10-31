"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { GenreVoteWaitingScreen } from "./genre-vote-waiting-screen";
import { MOCK_WAITING_PARTICIPANTS } from "./prototype-data";
import type { WaitingParticipant } from "./waiting-state";
import { summarizeParticipants } from "./waiting-state";
import { GENRE_RESULT_PATH } from "@/features/genre-result/prototype-data";
import { demoFlowUrl } from "../ui-flow/development-demo";
import { DevelopmentDemoNotice } from "../ui-flow/flow-message";
import styles from "./genre-vote-waiting.module.css";

const MANY_PARTICIPANT_COUNT = 12;
const PREVIEW_LONG_ROOM_ID = "prototype-room-with-a-long-identifier-2481";

export function GenreVoteWaitingPreview() {
  const router = useRouter();
  const [participants, setParticipants] = useState<readonly WaitingParticipant[]>(MOCK_WAITING_PARTICIPANTS);
  const [roomId, setRoomId] = useState<string>(PROTOTYPE_ROOM_ID);
  const [revealRequested, setRevealRequested] = useState<boolean>(false);

  useEffect(() => {
    if (revealRequested && summarizeParticipants(participants).allComplete) router.push(demoFlowUrl(GENRE_RESULT_PATH));
  }, [participants, revealRequested, router]);

  function showCompletedCount(count: number) {
    setParticipants(MOCK_WAITING_PARTICIPANTS.map((participant, index) => ({ ...participant, state: index < count ? "complete" : "waiting" })));
  }

  function showManyParticipants() {
    setParticipants(Array.from({ length: MANY_PARTICIPANT_COUNT }, (_, index) => ({
      ...MOCK_WAITING_PARTICIPANTS[index % MOCK_WAITING_PARTICIPANTS.length],
      id: `preview-participant-${index}`,
      nickname: index === 0 ? "とても長いニックネームの参加者の表示確認" : `参加者${index + 1}`,
    })));
    setRoomId(PREVIEW_LONG_ROOM_ID);
  }

  return (
    <GenreVoteWaitingScreen participants={participants} roomId={roomId} notice={<DevelopmentDemoNotice />}>
      <section className={styles.previewControls} aria-labelledby="waiting-preview-heading">
        <h2 id="waiting-preview-heading">開発用プレビュー</h2>
        <p>すべて仮データです。操作したときだけ状態が変わり、再読み込みすると2/3人に戻ります。</p>
        <BottomAction className={styles.previewBottom}>
          <div className={styles.previewActions}>
            {MOCK_WAITING_PARTICIPANTS.map((participant, index) => (
              <Button key={participant.id} type="button" variant="outline" onClick={() => showCompletedCount(index + 1)}>{index + 1}/{MOCK_WAITING_PARTICIPANTS.length}人を表示</Button>
            ))}
          </div>
          <div className={styles.previewActions}>
            {participants.map((participant) => (
              <Button key={participant.id} type="button" variant="soft" aria-pressed={participant.state === "complete"} aria-label={`${participant.nickname}の投票完了を切り替え`} onClick={() => setParticipants((current) => current.map((item) => item.id === participant.id ? { ...item, state: item.state === "complete" ? "waiting" : "complete" } : item))}>{participant.avatarText}：{participant.state === "complete" ? "完了" : "待機中"}</Button>
            ))}
          </div>
          <div className={styles.previewActions}>
            <Button type="button" variant="primary" onClick={() => { showCompletedCount(MOCK_WAITING_PARTICIPANTS.length); setRevealRequested(true); }}>全員完了から結果へ進む（モック）</Button>
            <Button type="button" variant="outline" onClick={showManyParticipants}>多数・長文を表示</Button>
            <Button type="button" variant="outline" onClick={() => setParticipants([])}>参加者なしを表示</Button>
            <Button type="button" variant="outline" onClick={() => { setParticipants(MOCK_WAITING_PARTICIPANTS); setRoomId(PROTOTYPE_ROOM_ID); }}>初期表示に戻す</Button>
          </div>
        </BottomAction>
      </section>
    </GenreVoteWaitingScreen>
  );
}
