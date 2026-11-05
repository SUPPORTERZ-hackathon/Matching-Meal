
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, LocateFixed, X, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { BottomAction } from "@/components/common/bottom-action";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/common/step-progress";
import { createRoom } from "../room/room-api";
import { requestCurrentLocation, type CurrentCoordinates, type CurrentLocationErrorCode, type CurrentLocationMode } from "../room/current-location";
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
  position_unavailable: "端末から現在地を取得できませんでした。通信環境と端末の位置情報設定を確認し、再試行してください。",
  timeout: "取得方法を変えても現在地を取得できませんでした。通信環境や位置情報設定を確認し、時間をおいて再試行してください。",
  invalid_coordinates: "取得した現在地を使用できませんでした。再度お試しください。",
  insecure_context: "現在地の取得にはHTTPS、またはこの端末のlocalhostでアプリを開いてください。",
  cancelled: "現在地の取得を中止しました。",
};

export function RoomCreateScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [coordinates, setCoordinates] = useState<CurrentCoordinates | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>("");
  const [locationMode, setLocationMode] = useState<CurrentLocationMode>("high");
  const [locationInfo, setLocationInfo] = useState<string>("");
  const [radiusIndex, setRadiusIndex] = useState(2);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const creatingRef = useRef<boolean>(false);
  const locatingRef = useRef<boolean>(false);
  const locationRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { locationRequest.current?.abort(); }, []);

  const radius = RADIUS_OPTIONS[radiusIndex];

  const canCreate = validNickname(nickname) && nickname.length <= 12 && coordinates !== null;

  async function locateCurrentPosition() {
    if (locatingRef.current || creatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setCoordinates(null);
    setLocationError("");
    setLocationInfo("");
    setCreateError("");
    const controller = new AbortController();
    locationRequest.current = controller;
    const result = await requestCurrentLocation(undefined, { signal: controller.signal, onMode: setLocationMode });
    if (controller.signal.aborted) return;
    if (result.ok) {
      setCoordinates(result.coordinates);
      setLocationInfo(result.mode === "standard" ? "標準モードで現在地を取得しました。位置の精度は端末の環境によって異なります。" : "現在地を取得しました。");
    } else {
      setLocationError(locationErrorMessages[result.code]);
    }
    locatingRef.current = false;
    locationRequest.current = null;
    setLocating(false);
  }

  function clearCurrentPosition() {
    if (locatingRef.current || creatingRef.current) return;
    setCoordinates(null);
    setLocationError("");
    setLocationInfo("");
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
      ? "作成結果を確認できませんでした。接続を確認し、入力内容を変えずにもう一度お試しください。" : result.error.status === 503 ? "サービスを利用できませんでした。時間をおいて同じ内容で再試行してください。続く場合は管理者に設定状況をご確認ください。" : result.error.message);
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
                disabled={creating}
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
                {locating ? "現在地を取得中…" : coordinates ? "現在地を再取得" : locationError ? "現在地の取得を再試行" : "現在地を取得"}
                </Button>
                {locating && <p className={styles.locationStatus} role="status">{locationMode === "standard" ? "標準モードへ切り替えて取得しています。最大20秒ほどかかります。" : "現在地を取得しています。取得できない場合は方法を切り替えます。"}</p>}
                {locationInfo && <p className={styles.locationStatus} role="status">{locationInfo}</p>}
                {locationError && <p id="current-location-error" className={styles.locationError} role="alert">{locationError}</p>}
                {locationError && <p className={styles.locationStatus}>Edgeでは、このサイトの位置情報の権限と、Windowsの「位置情報サービス」「デスクトップ アプリの位置情報へのアクセス」も確認してください。</p>}
                <p className={styles.locationStatus}>駅名や住所の手入力には対応していません。</p>
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
                disabled={creating}
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
          {createError && <p className={styles.locationStatus}>同じ内容で再試行できます。入力内容を変更すると新しい作成操作になります。作成結果が不明な間は再読み込みを避けてください。</p>}
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
