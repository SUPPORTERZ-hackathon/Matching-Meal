"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Camera, SwitchCamera } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { QR_SCAN, type ScanState } from "./qr-scan-data";
import { useQrScanner } from "./use-qr-scanner";
import styles from "./qr-scan.module.css";

const TITLES: Record<ScanState["phase"], string> = {
  idle: "カメラを起動してください", starting: "カメラを準備しています",
  scanning: "QRコードを読み取っています", paused: "読み取りを一時停止しました",
  error: "読み取りを停止しました", success: "参加画面を開いています",
};

export function QrScanScreen() {
  const { state, video: videoRef, ...scanner } = useQrScanner();
  const [inviteInput, setInviteInput] = useState<string>("");
  const live = state.phase === "scanning";
  const active = live || state.phase === "starting";
  const startLabel = state.phase === "success" ? "参加画面を開いています…" : state.pending ? "カメラを準備中…" : state.phase === "error" ? "もう一度試す" : state.phase === "paused" ? "カメラを再開する" : "カメラを起動する";
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); scanner.acceptUrl(inviteInput); }

  return <div className={styles.background}>
    <PageContainer className={styles.page} header={
      <AppHeader className={styles.header} layout="centered" leading={
        <Button variant="outline" size="icon-lg" className="rounded-[13px]" onClick={() => scanner.home()} aria-label="ホームに戻る">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
      } />
    }>
      <section className={styles.content}>
        <p className={styles.kicker}>QR SCAN</p>
        <h1 className={styles.title}>ルームに参加</h1>
        <p className={styles.description}>参加するルームのQRコードを読み取ってください</p>

        <div className={styles.cameraArea} data-live={live}>
          <video ref={videoRef} className={styles.video} autoPlay muted playsInline hidden={!active} aria-hidden={!live} aria-label="招待QRコードのカメラ映像" />
          {live && <span className={styles.scanGuide} aria-hidden="true" />}
          {!live && <div className={styles.cameraMessage}>
            <div className={styles.cameraIcon}><Camera aria-hidden="true" /></div>
            <h2 className={styles.cameraTitle}>{TITLES[state.phase]}</h2>
            <p className={styles.cameraDescription}>映像は送信せず、この端末でQRコードの読み取りにのみ使用します。</p>
            <Button type="button" variant="primary" size="meal" className={styles.cameraButton} disabled={state.pending || state.phase === "success"} loading={state.pending && state.phase !== "success"} onClick={() => scanner.start()}>{startLabel}</Button>
          </div>}
        </div>

        {active && <div className={styles.controls}>
          <Button type="button" variant="primary" size="meal" className={styles.cameraButton} onClick={() => scanner.stop()}>{state.pending ? "起動を中止" : "カメラを停止する"}</Button>
          {live && state.canSwitch && <Button type="button" variant="outline" size="meal" className={styles.cameraButton} disabled={state.pending} onClick={() => scanner.switchCamera()}><SwitchCamera aria-hidden="true" />カメラを切り替える</Button>}
        </div>}
        <p className={styles.scanStatus} role="status" aria-live="polite">
          {state.phase === "success" ? "招待情報を確認しました。ニックネーム入力画面へ進みます。"
            : state.pending && state.phase !== "starting" ? "カメラの許可確認が終了すると、もう一度起動できます。"
            : live ? "QRコードを枠内に収めてください。明るい場所で、距離を調整すると読み取りやすくなります。"
              : state.phase === "starting" ? "ブラウザーからカメラの利用許可を求められた場合は内容をご確認ください。"
                : state.phase === "paused" ? "画面を離れたためカメラを停止しました。再開するにはボタンを押してください。"
                  : "カメラが使えない場合は、共有された招待URLからも参加できます。"}
        </p>
        {state.issue && <p id="qr-scan-error" className={styles.error} role="alert">{state.issue.message}</p>}

        <details className={styles.fallback} onToggle={event => { if (event.currentTarget.open) scanner.stop(); }}>
          <summary>招待URLから参加する</summary>
          <form onSubmit={submit} noValidate>
            <label htmlFor="invite-url">招待URL</label>
            <input id="invite-url" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={QR_SCAN.maxUrlLength} value={inviteInput} onChange={event => setInviteInput(event.target.value)} placeholder="ホストから届いた招待URL" aria-describedby={state.issue ? "qr-scan-error" : "invite-url-help"} />
            <p id="invite-url-help">ホストと同じ公開URLで開いてください。参加登録は次の画面で行います。</p>
            <Button type="submit" variant="outline" size="meal" className={styles.cameraButton} disabled={!inviteInput.trim() || state.phase === "success"}>参加画面へ進む</Button>
          </form>
        </details>
        <button type="button" className={styles.homeButton} onClick={() => scanner.home()}><ArrowLeft aria-hidden="true" />ホームに戻る</button>
      </section>
    </PageContainer>
  </div>;
}
