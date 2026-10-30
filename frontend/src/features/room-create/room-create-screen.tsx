
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, LocateFixed, X, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/common/step-progress";
import styles from "./room-create.module.css";

const RADIUS_OPTIONS = [
  { value: 300, minutes: 4 },
  { value: 500, minutes: 6 },
  { value: 1000, minutes: 13 },
  { value: 2000, minutes: 25 },
  { value: 3000, minutes: 38 },
] as const;

export function RoomCreateScreen() {
    const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [location, setLocation] = useState("");
  const [radiusIndex, setRadiusIndex] = useState(2);

  const radius = RADIUS_OPTIONS[radiusIndex];

  const canCreate = nickname.trim().length > 0 && nickname.length <= 12 && location.trim().length > 0;
  
  console.log("入力状態:", {
    nickname,
    location,
    canCreate,
    });

  return (
    <div className={styles.background}>
      <PageContainer
        className={styles.page}
        header={
            <AppHeader
                className={styles.header}
                layout="centered"
                leading={
                <Button
                    variant="outline"
                    size="icon-lg"
                    className="rounded-[13px]"
                    onClick={() => router.back()}
                    aria-label="前の画面に戻る"
                >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                </Button>
                }
            />
            }
      >
        <StepProgress currentStep="room" />

        <section className={styles.content}>
          <p className={styles.kicker}>STEP 1</p>
          <h1 className={styles.title}>どこで集まる？</h1>
          <p className={styles.description}>
            お店を探す中心地点を決めましょう。
          </p>
          
          <div className={`meal-card ${styles.card}`}>
            <div className={styles.field}>
                <label htmlFor="host-nickname">あなたのニックネーム
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
                id="host-nickname"
                type="text"
                value={nickname}
                maxLength={12}
                placeholder="例：ゆうき"
                onChange={(event) => setNickname(event.target.value)}
                />
                <div className={styles.footerRow}>
                    <p className={styles.help}>参加者一覧に表示される名前です</p>
                    <span className={styles.counter}>{nickname.length}/12</span>
                </div>
            </div>
          </div>

          <div className={`meal-card ${styles.card}`}>
            <div className={styles.field}>
                <label htmlFor="room-location">集合場所</label>
                <div className={styles.locationInput}>
                <MapPin aria-hidden="true" />
                <input
                    id="room-location"
                    type="text"
                    value={location}
                    placeholder="駅名・住所などを入力"
                    onChange={(event) => setLocation(event.target.value)}
                />
                {location && (
                    <button
                    type="button"
                    className={styles.clearButton}
                    aria-label="場所をクリア"
                    onClick={() => setLocation("")}
                    >
                    <X aria-hidden="true" />
                    </button>
                )}
                </div>
                <Button
                type="button"
                variant="ghost"
                className={styles.currentLocationButton}
                >
                <LocateFixed aria-hidden="true" />
                現在地を取得
                </Button>
            </div>
          </div>

          <div className={`meal-card ${styles.card}`}>
            <div className={styles.field}>
                <div className={styles.radiusHeading}>
                <label htmlFor="search-radius">検索範囲</label>
                <strong>{radius.value >= 1000
                    ? `${radius.value / 1000}km`
                    : `${radius.value}m`}</strong>
                </div>

                <input
                id="search-radius"
                className={styles.radiusSlider}
                type="range"
                min={0}
                max={4}
                step={1}
                value={radiusIndex}
                onChange={(event) => setRadiusIndex(Number(event.target.value))}
                />

                <div className={styles.radiusLabels}>
                <span>300m</span>
                <span>3km</span>
                </div>

                <p className={styles.radiusHelpBox}>
                徒歩約{radius.minutes}分以内のお店を探します
                </p>
            </div>
          </div>
        </section>

        <BottomAction className={styles.actions}>
          <Button
            type="button"
            variant="primary"
            size="meal"
            disabled={!canCreate}
          >
            ルームを作成する
          </Button>
        </BottomAction>
      </PageContainer>
    </div>
  );
}
