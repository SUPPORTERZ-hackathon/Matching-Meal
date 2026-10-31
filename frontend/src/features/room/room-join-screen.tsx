"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { ROOM_CONFIG, normalizeJoinCode, roomWaitingUrl, validNickname } from "./room-data";
import { getRoomState, joinRoom } from "./room-api";
import { findRoomSession, forgetRoomSession, roomStorageAvailable, saveRoomSession } from "./room-session";
import { RoomFixedAction } from "./room-fixed-action";
import styles from "./room-waiting.module.css";

type RoomJoinScreenProps = { joinCode: string };
export function RoomJoinScreen({ joinCode }: RoomJoinScreenProps) {
  const router = useRouter();
  const code = normalizeJoinCode(joinCode);
  const [phase, setPhase] = useState<"checking" | "form" | "session-error">("checking");
  const [nickname, setNickname] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [joining, setJoining] = useState<boolean>(false);
  const locked = useRef<boolean>(false);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (disposed) return;
      const existing = code ? findRoomSession(code) : undefined;
      if (!existing) { setPhase("form"); return; }
      const result = await getRoomState(existing, controller.signal);
      if (disposed) return;
      if (result.ok) router.replace(roomWaitingUrl(result.data.room.id));
      else { setError(result.error.message); setPhase("session-error"); }
    });
    return () => { disposed = true; controller.abort(); };
  }, [code, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code || locked.current || phase !== "form" || !validNickname(nickname)) return;
    if (!roomStorageAvailable()) { setError("このブラウザーでは参加情報を保存できません。ストレージの設定を確認してから参加してください。"); return; }
    locked.current = true; setJoining(true); setError("");
    const result = await joinRoom(code, nickname);
    if (result.ok) {
      saveRoomSession(result.data);
      router.replace(roomWaitingUrl(result.data.room.id));
      return;
    }
    setError(["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(result.error.code)
      ? "参加結果を確認できませんでした。再送すると別の参加者になる可能性があります。接続を確認してください。" : result.error.message);
    locked.current = false; setJoining(false);
  }
  function enterAgain() {
    const existing = code ? findRoomSession(code) : undefined;
    if (existing) forgetRoomSession(existing.room.id);
    setError(""); setPhase("form");
  }
  return <div className={styles.background}><PageContainer className={styles.page} header={<AppHeader roomNumber={code} />} bottomAction={code && phase === "form" ? <RoomFixedAction note="参加すると、このルームのメンバーに名前が表示されます"><Button type="submit" form="join-room-form" variant="primary" size="meal" disabled={!validNickname(nickname) || joining} loading={joining}>参加する<ChevronRight aria-hidden="true" /></Button></RoomFixedAction> : undefined}>
    <div className={styles.content}>
      {!code ? <section className={`meal-card ${styles.message}`} role="alert"><h1>招待リンクが正しくありません</h1><p>送信者に招待リンクをもう一度確認してください。</p><Link href="/home-preview">ホームに戻る</Link></section>
        : phase === "checking" ? <section className={styles.message} role="status"><h1>参加情報を確認しています</h1></section>
          : <>
            <section className={styles.joinHero}><div className={styles.roomIcon}><Users aria-hidden="true" /></div><p className={styles.kicker}>招待されています</p><h1>ルームに参加しよう</h1><p className={styles.code}>参加コード：{code}</p></section>
            {phase === "form" && <form id="join-room-form" className={`meal-card ${styles.joinForm}`} onSubmit={submit}><label htmlFor="join-nickname">ニックネーム</label><input id="join-nickname" value={nickname} maxLength={ROOM_CONFIG.nicknameLimit} autoComplete="nickname" placeholder="例：みさき" onChange={(event) => setNickname(event.target.value)} disabled={joining} aria-describedby="join-nickname-help" /><div className={styles.fieldMeta}><p id="join-nickname-help">ルーム内で表示される名前です</p><span>{nickname.length}/{ROOM_CONFIG.nicknameLimit}</span></div></form>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {phase === "session-error" && <div className={styles.message}><Button type="button" variant="outline" onClick={enterAgain}>保存済み情報を破棄して参加し直す</Button><Link href="/home-preview">ホームに戻る</Link></div>}
          </>}
    </div>
  </PageContainer></div>;
}
