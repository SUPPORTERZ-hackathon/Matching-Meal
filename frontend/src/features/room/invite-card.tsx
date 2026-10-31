"use client";

import { useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { GENRE_ICON_PATH } from "../genre-vote/prototype-config";
import { isLocalOrigin } from "./room-data";
import styles from "./room-waiting.module.css";

type InviteCardProps = { url: string; joinCode: string };
const QR_SIZE = 192, QR_EXPANDED_SIZE = 320, QR_LOGO_SIZE = 22, QR_QUIET_ZONE = 4;
const QR_LOGO = `${GENRE_ICON_PATH}/icon-192.png`;
export function InviteCard({ url, joinCode }: InviteCardProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const local = isLocalOrigin(url);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  function qr(size: number) {
    return <QRCodeSVG value={url} size={size} marginSize={QR_QUIET_ZONE} level="H" bgColor="#FFFFFF" fgColor="#272321" title={`ルーム${joinCode}の招待QRコード`} role="img" imageSettings={{ src: QR_LOGO, width: QR_LOGO_SIZE, height: QR_LOGO_SIZE, excavate: true }} data-invite-qr />;
  }
  return <section className={`meal-card ${styles.inviteCard}`} aria-label="ルームへの招待">
    <div className={styles.qrFrame}>{qr(QR_SIZE)}</div>
    <Button type="button" variant="link" className={styles.expandLink} onClick={() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }}>QRコードを拡大</Button>
    <div className={styles.urlRow}>
      <code className={styles.url} data-invite-url>{url}</code>
      <Button type="button" variant="outline" className={styles.copyButton} onClick={copy} aria-label="招待URLをコピー"><Copy aria-hidden="true" />{copyState === "copied" ? "コピー済み" : "コピー"}</Button>
    </div>
    <p className={styles.feedback} role={copyState === "failed" ? "alert" : "status"} aria-live="polite">{copyState === "copied" ? "招待URLをコピーしました" : copyState === "failed" ? "コピーできませんでした。表示中のURLを選択してコピーしてください。" : ""}</p>
    {local && <p className={styles.localNote}>このURLは同じPCでの確認用です。別端末へ共有するには、公開URLからアプリを開いてください。</p>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="invite-qr-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.dialogHeading}><h2 id="invite-qr-title">招待用QRコード</h2><Button type="button" variant="ghost" size="icon-lg" aria-label="QRコードの拡大を閉じる" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></Button></div>
      <div className={styles.expandedQr}>{qr(QR_EXPANDED_SIZE)}</div><p className={styles.code}>参加コード：{joinCode}</p>
    </dialog>
  </section>;
}
