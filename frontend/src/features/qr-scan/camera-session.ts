import { cameraIssue, INITIAL_SCAN_STATE, parseInviteInput, QR_SCAN, scanIssue, type QrDecoder, type QrFrame, type ScanIssue, type ScanState } from "./qr-scan-data";

type ScanVideo = HTMLVideoElement;
type CameraDependencies = {
  origin: string; secure: boolean; visible: () => boolean;
  media?: Pick<MediaDevices, "getUserMedia"> & Partial<Pick<MediaDevices, "enumerateDevices">>;
  loadDecoder: () => Promise<QrDecoder>;
  frame: (video: ScanVideo) => QrFrame | undefined;
  clearFrame: () => void;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
  onState: (state: ScanState) => void;
  onInvite: (path: string) => void;
};

export function createCameraSession(deps: CameraDependencies) {
  let view: ScanState = { ...INITIAL_SCAN_STATE }, generation = 0, disposed = false, navigated = false, pending = false;
  let stream: MediaStream | undefined, video: ScanVideo | undefined, timer: number | undefined;
  let decoder: QrDecoder | undefined, cameras: string[] = [], selected = "", ended: (() => void) | undefined;
  function update(patch: Partial<ScanState>) { view = { ...view, ...patch }; if (!disposed) deps.onState(view); }
  function release() {
    if (timer !== undefined) deps.cancel(timer); timer = undefined;
    const previous = stream; stream = undefined;
    previous?.getTracks().forEach(track => { if (ended) track.removeEventListener("ended", ended); track.stop(); });
    ended = undefined;
    if (video) { video.pause(); video.srcObject = null; video = undefined; }
    cameras = []; selected = ""; deps.clearFrame();
  }
  function stop(phase: "idle" | "paused" = "idle") {
    generation++; release();
    if (!disposed && !navigated) update({ phase, pending, canSwitch: false, issue: undefined });
  }
  function fail(issue: ScanIssue) { generation++; release(); update({ phase: "error", pending, canSwitch: false, issue }); }
  function accept(input: string) {
    if (disposed || navigated) return;
    const result = parseInviteInput(input, deps.origin);
    if (!result.ok) { fail(result.issue); return; }
    navigated = true; generation++; release();
    update({ phase: "success", pending, canSwitch: false, issue: undefined });
    deps.onInvite(result.path);
  }
  async function start(target: ScanVideo, deviceId?: string) {
    if (disposed || navigated || pending || view.phase === "scanning") return;
    if (!deps.secure) { fail(scanIssue("insecure")); return; }
    if (!deps.media?.getUserMedia) { fail(scanIssue("unsupported")); return; }
    if (!deps.visible()) { stop("paused"); return; }
    const ticket = ++generation;
    function current() {
      if (disposed || ticket !== generation) return false;
      if (!deps.visible()) { stop("paused"); return false; }
      return true;
    }
    pending = true; update({ phase: "starting", pending: true, canSwitch: false, issue: undefined });
    let stage: "decoder" | "camera" | "video" = "decoder";
    try {
      decoder ??= await deps.loadDecoder();
      if (!current()) return;
      stage = "camera";
      const constraints: MediaStreamConstraints = { audio: false, video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
        width: { ideal: QR_SCAN.idealWidth }, height: { ideal: QR_SCAN.idealHeight },
      } };
      let acquired: MediaStream;
      try { acquired = await deps.media.getUserMedia(constraints); }
      catch (error) {
        const retry = error instanceof Error && (error.name === "OverconstrainedError" || (deviceId && error.name === "NotFoundError"));
        if (!current() || !retry) throw error;
        acquired = await deps.media.getUserMedia({ audio: false, video: true });
      }
      if (!current()) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; video = target; target.srcObject = acquired;
      ended = () => { if (current()) fail(scanIssue("camera_ended")); };
      acquired.getTracks().forEach(track => track.addEventListener("ended", ended!));
      selected = acquired.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? "";
      stage = "video";
      await target.play();
      if (!current()) return;
      update({ phase: "scanning" });
      // 許可後にのみデバイスを調べる。取得失敗は読み取り自体を止めない。
      void Promise.resolve().then(() => deps.media?.enumerateDevices?.() ?? []).then(devices => {
        if (!current()) return;
        cameras = [...new Set(devices.filter(device => device.kind === "videoinput" && device.deviceId).map(device => device.deviceId))];
        update({ canSwitch: cameras.length > 1 });
      }).catch(() => { if (current()) update({ canSwitch: false }); });
      function scan() {
        timer = undefined;
        if (!current()) return;
        try {
          const frame = deps.frame(target), text = frame && decoder?.(frame);
          if (text !== undefined) { accept(text); return; }
        } catch { fail(scanIssue("decoder_failed")); return; }
        if (current()) timer = deps.schedule(scan, QR_SCAN.frameInterval);
      }
      timer = deps.schedule(scan, 0);
    } catch (error) {
      if (current()) fail(stage === "decoder" ? scanIssue("decoder_failed") : stage === "video" ? scanIssue("video_failed") : error instanceof Error ? cameraIssue(error) : scanIssue("camera_failed"));
    } finally { pending = false; if (!disposed) update({ pending: false }); }
  }
  return {
    start, stop, accept,
    switchCamera(target: ScanVideo) {
      if (pending || disposed || navigated || !stream || cameras.length < 2) return;
      const next = cameras[(cameras.indexOf(selected) + 1) % cameras.length];
      stop(); void start(target, next);
    },
    dispose() { disposed = true; generation++; release(); },
  };
}
