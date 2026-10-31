
"use client";

import { useState } from "react";
import { Users, MapPin, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import styles from "./room-join.module.css";

// 仮のルーム情報
const ROOM_INFO = {
  number: "2481",
  name: "ゆうきさんのルーム",
  location: "渋谷駅から1.5km",
};

export function RoomJoinScreen() {
  const [nickname, setNickname] = useState("");

  const canJoin =
    nickname.trim().length > 0 && nickname.length <= 12;

  return (
    <div className={styles.background}>
      <PageContainer
        className={styles.page}
        header={
          <AppHeader
            className={styles.header}
            roomNumber={ROOM_INFO.number}
          />
        }
      >
        <section className={styles.content}>
          {/* 招待・ルーム情報 */}
            <section className={styles.invitation}>
            <div className={styles.invitationIcon}>
                <Users aria-hidden="true" />
            </div>

            <p className={styles.invitationLabel}>
                招待されています
            </p>

            <h1 className={styles.roomName}>
                {ROOM_INFO.name}
            </h1>

            <p className={styles.location}>
                <MapPin aria-hidden="true" />
                {ROOM_INFO.location}
            </p>
            </section>

          {/* ニックネーム入力 */}
          <div className={`meal-card ${styles.nicknameCard}`}>
            <div className={styles.field}>
              <label htmlFor="participant-nickname">
                ニックネーム
                <span
                  className={`${styles.required} ${
                    nickname.trim().length > 0 && nickname.length <= 12
                        ? styles.valid
                        : ""
                  }`}
                >
                  {nickname.length > 12
                    ? "文字数超過"
                    : nickname.trim().length > 0
                        ? "入力OK"
                        : "未入力"}
                </span>
              </label>

              <input
                id="participant-nickname"
                type="text"
                value={nickname}
                maxLength={12}
                placeholder="例：みさき"
                onChange={(event) => setNickname(event.target.value)}
              />

              <div className={styles.footerRow}>
                <p className={styles.help}>
                  ルーム内で表示される名前です
                </p>

                <span className={styles.counter}>
                  {nickname.length}/12
                </span>
              </div>
            </div>
          </div>
        </section>

        <BottomAction className={styles.actions}>
          <Button
            type="button"
            variant="primary"
            size="meal"
            disabled={!canJoin}
          >
            参加する
            <ChevronRight aria-hidden="true" className={styles.buttonIcon} />
          </Button>
        </BottomAction>
      </PageContainer>
    </div>
  );
}
