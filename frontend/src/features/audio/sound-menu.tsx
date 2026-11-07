"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAudio } from "./audio-provider";

export function SoundMenu() {
  const { settings, failedTrack, setBgmEnabled, setSeEnabled } = useAudio();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bgmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    bgmButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) {
        setOpen(false);
        if (panel.current?.contains(document.activeElement)) trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("pointerdown", onPointerDown); };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    if (panel.current?.contains(document.activeElement)) trigger.current?.focus();
  }

  return <div className="meal-sound-menu">
    <button ref={trigger} type="button" className="meal-sound-trigger" aria-label={open ? "メニューを閉じる" : "メニューを開く"} aria-expanded={open} aria-controls="meal-sound-panel" onClick={() => open ? closeMenu() : setOpen(true)}>
      {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
    </button>
    {open && <div ref={panel} id="meal-sound-panel" className="meal-sound-panel" role="group" aria-label="サウンド設定">
      <strong>サウンド設定</strong>
      <button ref={bgmButton} type="button" role="switch" aria-checked={settings.bgm} className="meal-sound-switch" onClick={() => setBgmEnabled(!settings.bgm)}><span>BGM</span><span aria-hidden="true" className="meal-sound-switch-state">{settings.bgm ? "ON" : "OFF"}</span></button>
      <button type="button" role="switch" aria-checked={settings.se} className="meal-sound-switch" onClick={() => setSeEnabled(!settings.se)}><span>SE</span><span aria-hidden="true" className="meal-sound-switch-state">{settings.se ? "ON" : "OFF"}</span></button>
      {failedTrack && <p className="meal-sound-error" role="status">音声を読み込めませんでした。音源と通信状態をご確認ください。</p>}
    </div>}
  </div>;
}
