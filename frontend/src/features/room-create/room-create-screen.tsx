
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, LocateFixed, X, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/common/step-progress";
import { createRoom } from "../room/room-api";
import { requestCurrentLocation, type CurrentCoordinates, type CurrentLocationErrorCode } from "../room/current-location";
import { roomWaitingUrl, validNickname } from "../room/room-data";
import { roomStorageAvailable, saveRoomSession } from "../room/room-session";
import styles from "./room-create.module.css";

const RADIUS_OPTIONS = [
  { value: 300, minutes: 4, apiRange: 1 },
  { value: 500, minutes: 6, apiRange: 2 },
  { value: 1000, minutes: 13, apiRange: 3 },
  { value: 2000, minutes: 25, apiRange: 4 },
  { value: 3000, minutes: 38, apiRange: 5 },
] as const;

const locationErrorMessages: Record<CurrentLocationErrorCode, string> = {
  unsupported: "このブラウザーでは現在地を取得できません。対応ブラウザーで再度お試しください。",
  permission_denied: "現在地の利用が許可されていません。ブラウザーの権限設定を確認して再度お試しください。",
  position_unavailable: "現在地を取得できませんでした。通信環境を確認して再度お試しください。",
  timeout: "現在地の取得がタイムアウトしました。場所を変えるか、時間をおいて再度お試しください。",
  invalid_coordinates: "取得した現在地を使用できませんでした。再度お試しください。",
};

export function RoomCreateScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [coordinates, setCoordinates] = useState<CurrentCoordinates | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>("");
  const [radiusIndex, setRadiusIndex] = useState(2);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const creatingRef = useRef<boolean>(false);
  const locatingRef = useRef<boolean>(false);

  const radius = RADIUS_OPTIONS[radiusIndex];

  const canCreate = validNickname(nickname) && nickname.length <= 12 && coordinates !== null;

  async function locateCurrentPosition() {
    if (locatingRef.current || creatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setCoordinates(null);
    setLocationError("");
    setCreateError("");
    const result = await requestCurrentLocation();
    if (result.ok) {
      setCoordinates(result.coordinates);
    } else {
      setLocationError(locationErrorMessages[result.code]);
    }
    locatingRef.current = false;
    setLocating(false);
  }

  function clearCurrentPosition() {
    if (locatingRef.current || creatingRef.current) return;
    setCoordinates(null);
    setLocationError("");
  }

  async function submitRoom() {
    if (!canCreate || !coordinates || creatingRef.current) return;
    if (!roomStorageAvailable()) { setCreateError("このブラウザーでは参加情報を保存できません。ストレージの設定を確認してください。"); return; }
    creatingRef.current = true; setCreating(true); setCreateError("");
    const result = await createRoom({
      nickname,
      searchLocation: coordinates,
      searchRange: radius.apiRange,
    });
    if (result.ok) {
      saveRoomSession({ ...result.data, localSearch: { location: "現在地を使用", radiusMeters: radius.value } });
      router.push(roomWaitingUrl(result.data.room.id));
      return;
    }
    setCreateError(["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"].includes(result.error.code)
      ? "作成結果を確認できませんでした。再送すると別のルームが作成される可能性があります。接続を確認してください。" : result.error.message);
    creatingRef.current = false; setCreating(false);
  }

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
                    onClick={() => router.push("/home-preview")}
                    aria-label="ホームに戻る"
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
                    value={coordinates ? "現在地を使用" : ""}
                    placeholder="現在地を取得してください"
                    readOnly
                    aria-describedby={locationError ? "current-location-error" : undefined}
                />
                {coordinates && (
                    <button
                    type="button"
                    className={styles.clearButton}
                    aria-label="取得した現在地をクリア"
                    onClick={clearCurrentPosition}
                    disabled={creating}
                    >
                    <X aria-hidden="true" />
                    </button>
                )}
                </div>
                <Button
                type="button"
                variant="ghost"
                className={styles.currentLocationButton}
                disabled={locating || creating}
                loading={locating}
                onClick={locateCurrentPosition}
                >
                <LocateFixed aria-hidden="true" />
                {coordinates ? "現在地を再取得" : "現在地を取得"}
                </Button>
                {locationError && <p id="current-location-error" className={styles.locationError} role="alert">{locationError}</p>}
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
          <p className={styles.apiNote}>取得した現在地は店舗検索にだけ使用し、座標の数値は画面やURLに表示しません。</p>
          {createError && <p className={styles.apiError} role="alert">{createError}</p>}
        </section>

        <FixedBottomAction><BottomAction>
          <Button
            type="button"
            variant="primary"
            size="meal"
            disabled={!canCreate || creating}
            loading={creating}
            onClick={submitRoom}
          >
            ルームを作成する
          </Button>
        </BottomAction></FixedBottomAction>
      </PageContainer>
    </div>
  );
}
