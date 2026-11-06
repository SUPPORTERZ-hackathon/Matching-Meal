import { normalizeJoinCode } from "../room/room-data";

export const QR_SCAN = { maxUrlLength: 2048, frameInterval: 250, maxFrameEdge: 640, idealWidth: 1280, idealHeight: 720 } as const;
export type ScanIssueCode = "insecure" | "unsupported" | "denied" | "not_found" | "busy" | "constraints" | "camera_ended" | "camera_failed" | "video_failed" | "decoder_failed" | "invalid_invite" | "foreign_origin";
export type ScanIssue = { code: ScanIssueCode; message: string };
export type ScanState = { phase: "idle" | "starting" | "scanning" | "paused" | "error" | "success"; pending: boolean; canSwitch: boolean; issue?: ScanIssue };
export const INITIAL_SCAN_STATE: ScanState = { phase: "idle", pending: false, canSwitch: false };
export type QrFrame = { data: Uint8ClampedArray; width: number; height: number };
export type QrDecoder = (frame: QrFrame) => string | undefined;

const MESSAGES: Record<ScanIssueCode, string> = {
  insecure: "カメラにはHTTPS、またはこの端末のlocalhostでのアクセスが必要です。共有された招待URLからも参加できます。",
  unsupported: "このブラウザーではカメラを利用できません。共有された招待URLから参加してください。",
  denied: "カメラの利用が許可されていません。ブラウザーと端末の権限設定をご確認ください。",
  not_found: "利用できるカメラが見つかりません。カメラの接続を確認するか、招待URLから参加してください。",
  busy: "カメラを使用できません。別のアプリで使用していないか、接続状況をご確認ください。",
  constraints: "このカメラで読み取りを開始できませんでした。別のカメラか招待URLをお試しください。",
  camera_ended: "カメラとの接続が終了しました。接続を確認して、もう一度起動してください。",
  camera_failed: "カメラを起動できませんでした。接続状況を確認して再試行してください。",
  video_failed: "カメラ映像を表示できませんでした。もう一度起動するか、招待URLから参加してください。",
  decoder_failed: "QRコードの読み取りを開始・継続できませんでした。接続を確認して再試行してください。",
  invalid_invite: "メシマッチの招待QRコードではありません。ホストの招待QRコードか招待URLをご確認ください。",
  foreign_origin: "このアプリと同じURLで発行した招待を使用してください。ホストと同じ公開URLで開き直してください。localhostのQRは別端末では利用できません。",
};
export const scanIssue = (code: ScanIssueCode): ScanIssue => ({ code, message: MESSAGES[code] });
export function cameraIssue(error: Error): ScanIssue {
  switch (error.name) {
    case "NotAllowedError": case "SecurityError": return scanIssue("denied");
    case "NotFoundError": case "DevicesNotFoundError": return scanIssue("not_found");
    case "NotReadableError": case "TrackStartError": case "AbortError": return scanIssue("busy");
    case "OverconstrainedError": case "ConstraintNotSatisfiedError": return scanIssue("constraints");
    default: return scanIssue("camera_failed");
  }
}

// URL/QRをナビゲーション先として直接使用せず、検証した招待コードだけを渡す。
export function parseInviteInput(input: string, currentOrigin: string): { ok: true; path: string } | { ok: false; issue: ScanIssue } {
  const raw = input.trim();
  const invalid = (): { ok: false; issue: ScanIssue } => ({ ok: false, issue: scanIssue("invalid_invite") });
  if (!raw || input.length > QR_SCAN.maxUrlLength || /[\p{Cc}\\]/u.test(input) || !/^https?:\/\//i.test(raw) || raw.includes("?") || raw.includes("#")) return invalid();
  try {
    const url = new URL(raw), origin = new URL(currentOrigin);
    if (!["http:", "https:"].includes(url.protocol) || !["http:", "https:"].includes(origin.protocol) || url.username || url.password) return invalid();
    const match = /^\/j\/([^/]+)\/?$/.exec(url.pathname);
    const code = match ? normalizeJoinCode(match[1]) : undefined;
    if (!code) return invalid();
    if (url.origin !== origin.origin) return { ok: false, issue: scanIssue("foreign_origin") };
    return { ok: true, path: `/j/${encodeURIComponent(code)}` };
  } catch { return invalid(); }
}
