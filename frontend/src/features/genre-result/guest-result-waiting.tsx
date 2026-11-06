"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { useRoomState } from "../room/use-room-state";
import { guestResultDestination } from "./guest-result-destination";
import styles from "./genre-result.module.css";

export function GuestResultWaiting({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { view } = useRoomState(roomId);
  const redirected = useRef(false);
  const destination = view.kind === "ready" && !view.staleError
    ? guestResultDestination(view.session.participant.role, view.snapshot.room) : undefined;

  useEffect(() => {
    if (destination && !redirected.current) {
      redirected.current = true;
      router.replace(destination);
    }
  }, [destination, router]);

  const error = view.kind === "error" ? view.error : view.kind === "ready" ? view.staleError : undefined;
  const expired = view.kind === "ready" && view.snapshot.room.status === "expired";
  const searching = view.kind === "ready" && view.snapshot.room.status === "restaurant_searching";
  const ready = view.kind === "ready" && (view.snapshot.room.status === "restaurant_voting" || view.snapshot.room.status === "decided");

  return <FixedBottomAction data-result-waiting>
    <BottomAction>
      <div className={styles.guestWaiting} role="status" aria-live="polite" aria-atomic="true">
        <strong>{error || expired ? "ルームの状態を確認できません" : ready ? "お店の投票を準備しています" : searching ? "ホストが店舗を探しています" : "ルームの進行状況を確認しています"}</strong>
        <span>{error ? error.message : expired ? "ルームの有効期限が切れました。" : ready ? "準備ができ次第、次の画面へ進みます" : searching ? "お店の投票開始までお待ちください" : "店舗検索が始まるまでお待ちください"}</span>
      </div>
    </BottomAction>
  </FixedBottomAction>;
}
