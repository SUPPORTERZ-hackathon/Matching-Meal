"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCameraSession } from "./camera-session";
import { INITIAL_SCAN_STATE, QR_SCAN, type QrFrame, type ScanState } from "./qr-scan-data";

function createFrameCapture() {
  let canvas: HTMLCanvasElement | undefined;
  return {
    read(video: HTMLVideoElement): QrFrame | undefined {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
      canvas ??= document.createElement("canvas");
      const side = Math.min(video.videoWidth, video.videoHeight), edge = Math.min(side, QR_SCAN.maxFrameEdge);
      if (canvas.width !== edge || canvas.height !== edge) { canvas.width = edge; canvas.height = edge; }
      const context = canvas.getContext("2d", { willReadFrequently: true, alpha: false });
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, edge, edge);
      return context.getImageData(0, 0, edge, edge);
    },
    clear() { if (canvas) { canvas.width = 0; canvas.height = 0; canvas = undefined; } },
  };
}

export function useQrScanner() {
  const router = useRouter();
  const [state, setState] = useState<ScanState>({ ...INITIAL_SCAN_STATE });
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<ReturnType<typeof createCameraSession> | null>(null);
  useEffect(() => {
    const capture = createFrameCapture();
    const camera = createCameraSession({
      origin: window.location.origin, secure: window.isSecureContext, visible: () => !document.hidden,
      media: navigator.mediaDevices,
      loadDecoder: async () => (await import("./qr-decoder")).createQrDecoder(),
      frame: capture.read, clearFrame: capture.clear,
      schedule: (callback, delay) => window.setTimeout(callback, delay), cancel: timer => window.clearTimeout(timer),
      onState: setState, onInvite: path => router.push(path),
    });
    session.current = camera;
    const pause = () => camera.stop("paused");
    const visibility = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pause);
    return () => {
      camera.dispose(); if (session.current === camera) session.current = null;
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pause);
    };
  }, [router]);
  return {
    state, video,
    start: () => { if (video.current) void session.current?.start(video.current); },
    stop: () => session.current?.stop(),
    switchCamera: () => { if (video.current) session.current?.switchCamera(video.current); },
    acceptUrl: (input: string) => session.current?.accept(input),
    home: () => { session.current?.stop(); router.push("/home-preview"); },
  };
}
