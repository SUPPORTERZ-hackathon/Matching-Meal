"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { ParticipantAvatar } from "@/components/common/participant-avatar";
import { StepProgress } from "@/components/common/step-progress";
import { Button } from "@/components/ui/button";
import { ROOM_CONFIG, inviteUrl, roomGenreUrl } from "./room-data";
import { startRoomVoting } from "./room-api";
import { useRoomState } from "./use-room-state";
import { InviteCard } from "./invite-card";
import { RoomFixedAction } from "./room-fixed-action";
import styles from "./room-waiting.module.css";

type RoomWaitingScreenProps = { roomId?: string };
const TONES = ["peach", "pink", "blue"] as const;
export function RoomWaitingScreen({ roomId }: RoomWaitingScreenProps) {
  const { view, retry } = useRoomState(roomId);
  const router = useRouter();
  const [starting, setStarting] = useState<boolean>(false);
  const [startError, setStartError] = useState<string>("");
  const locked = useRef<boolean>(false);
  useEffect(() => {
    if (view.kind === "ready" && !view.staleError && view.snapshot.room.status === "genre_voting") router.replace(roomGenreUrl(view.snapshot.room.id));
  }, [view, router]);

  const snapshot = view.kind === "ready" ? view.snapshot : undefined;
  const current = snapshot?.participants.find((row) => row.id === snapshot.currentParticipantId);
  const host = current?.role === "host";
  const lobby = snapshot?.room.status === "lobby";
  const url = view.kind === "ready" && lobby ? inviteUrl(view.origin, view.snapshot.room.joinCode) : undefined;
  const canStart = host && lobby && !!snapshot && snapshot.participants.length >= ROOM_CONFIG.minimumParticipants && view.kind === "ready" && !view.staleError;
  async function start() {
    if (locked.current || !canStart || view.kind !== "ready") return;
    locked.current = true; setStarting(true); setStartError("");
    const result = await startRoomVoting(view.session);
    if (result.ok) { router.replace(roomGenreUrl(result.data.room.id)); return; }
    setStartError(result.error.message); retry();
    setStarting(false); locked.current = false;
  }
  return <div className={styles.background}><PageContainer className={styles.page} header={<AppHeader roomNumber={snapshot?.room.joinCode} />} bottomAction={snapshot ? <RoomFixedAction note={host ? snapshot.participants.length < ROOM_CONFIG.minimumParticipants ? "2人以上の参加で投票を開始できます" : "ホストのあなただけが開始できます" : "ホストが開始するまで、この画面のままお待ちください"}>
    {host ? <Button type="button" variant="primary" size="meal" onClick={start} disabled={!canStart || starting} loading={starting}>投票を開始する<ChevronRight aria-hidden="true" /></Button> : <p className={styles.guestWaiting}>投票開始を待っています…</p>}
  </RoomFixedAction> : undefined}>
    <StepProgress currentStep="room" />
    <div className={styles.content}>
      {view.kind === "loading" ? <section role="status" className={styles.message}><h1>ルームを確認しています</h1><p>参加情報を取得しています。</p></section>
        : view.kind === "error" ? <section className={`meal-card ${styles.message}`} role="alert"><h1>ルームを表示できません</h1><p>{view.error.message}</p><Button variant="outline" type="button" onClick={retry}>もう一度確認する</Button><Link href="/home-preview">ホームに戻る</Link></section>
          : <>
            <section className={styles.hero}><span className={styles.live}><i aria-hidden="true" />{lobby ? "参加者を待っています" : "参加受付は終了しました"}</span><h1>{lobby ? "友達を招待しよう" : "ルームの進行状況"}</h1><p>{lobby ? "QRコードかリンクをシェアしてください。" : "このルームはすでに次のステップへ進んでいます。"}</p></section>
            {view.staleError && <div className={styles.error} role="alert"><p>{view.staleError.message} 参加者情報は最後に取得した内容です。</p><Button variant="outline" type="button" onClick={retry}>再取得する</Button></div>}
            {view.session.persistenceWarning && <p className={styles.error} role="alert">参加情報を保存できませんでした。このタブでは利用できますが、再読み込み後は復元できません。</p>}
            {url && <InviteCard key={url} url={url} joinCode={view.snapshot.room.joinCode} />}
            <section aria-labelledby="room-members-heading"><div className={styles.membersHeading}><h2 id="room-members-heading">参加メンバー</h2><span role="status" aria-live="polite"><Users aria-hidden="true" />{view.snapshot.participants.length}人</span></div>
              <ul className={styles.members}>{view.snapshot.participants.map((member, index) => <li key={member.id} className={styles.member} data-participant-id={member.id}>
                <ParticipantAvatar nickname={member.nickname} tone={TONES[index % TONES.length]} />
                {member.role === "host" ? <span className={styles.role}>ホスト</span> : member.id === current?.id ? <span className={styles.role}>あなた</span> : null}
                <span className={styles.joined}><i aria-hidden="true" /><span className="sr-only">参加済み</span></span>
              </li>)}</ul>
            </section>
            {view.session.localSearch && <p className={styles.localNote}>集合場所・検索範囲はホスト端末内のみの保存です。サーバーにはまだ連携していません。</p>}
            {startError && <p className={styles.error} role="alert">{startError}</p>}
          </>}
    </div>
  </PageContainer></div>;
}
