"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { getHomeCarouselGenres } from "./home-food-data";
import { HomeFoodCarousel } from "./home-food-carousel";
import { HomeLaunch, type HomeLaunchPhase } from "./home-launch";
import { useAudio } from "../audio/audio-provider";
import "./home-preview.css"

const HOME_GENRES = getHomeCarouselGenres(GENRES);
const LAUNCH_SEEN_KEY = "meal-home-launch-seen";
const LAUNCH_HOLD_MS = 820;
const LAUNCH_EXIT_MS = 280;
const CONTENT_SETTLE_MS = 250;
let launchedWithoutStorage = false;

export function HomePreviewScreen() {
  const router = useRouter();
  const { settings, blockedTrack, failedTrack, setBgmEnabled, startHomeBgm } = useAudio();
  const [launch, setLaunch] = useState<HomeLaunchPhase>("ready");
  const decision = useRef<boolean | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (decision.current === null) {
      let seen = launchedWithoutStorage;
      try { seen = seen || sessionStorage.getItem(LAUNCH_SEEN_KEY) === "1"; }
      catch { /* Storage が使えなくてもホームは表示する。 */ }
      decision.current = !seen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      launchedWithoutStorage = true;
      try { sessionStorage.setItem(LAUNCH_SEEN_KEY, "1"); }
      catch { /* 同一ページ内での再生は decision で防ぐ。 */ }
    }
    if (!decision.current) return;
    setLaunch("playing");
    timers.current = [
      setTimeout(() => setLaunch("leaving"), LAUNCH_HOLD_MS),
      setTimeout(() => setLaunch("settling"), LAUNCH_HOLD_MS + LAUNCH_EXIT_MS),
      setTimeout(() => setLaunch("ready"), LAUNCH_HOLD_MS + LAUNCH_EXIT_MS + CONTENT_SETTLE_MS),
    ];
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  function skipLaunch() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLaunch("ready");
  }

  return (
    <PageContainer header={<AppHeader />} className="home-preview-page">
      <div className="home-preview-content" data-launch={launch}>
        <HomeFoodCarousel genres={HOME_GENRES} />

        <section className="home-preview-intro">
          <p className="home-preview-eyebrow">
            もう「どこ行く？」で迷わない
          </p>

          <h1>
            <span className="home-preview-title-line">
              みんなで決める、
            </span>
            <span className="home-preview-title-line">
              ご飯選び！
            </span>
          </h1>

          <p className="home-preview-description">
            好きな料理を選ぶだけ。みんなの「食べたい」が
            重なるお店を見つけよう。
          </p>
        </section>

        <div className="home-preview-actions">
          {(!settings.bgm || blockedTrack === "home-bgm" || failedTrack === "home-bgm") && (
            <button type="button" className="home-preview-sound-start" onClick={() => settings.bgm ? startHomeBgm() : setBgmEnabled(true)}>
              音ありで楽しむ
            </button>
          )}
          <Button variant="primary" size="meal" type="button" data-tap-particles="accent" onClick={() => router.push("/room-create")}>
            <span className="home-preview-action-label">
              ルームを作成する
            </span>
            <ChevronRight aria-hidden="true" />
          </Button>

          <Button variant="outline" size="meal" type="button" onClick={() => router.push("/qr-scan")}>
            <QrCode aria-hidden="true" />
            <span className="home-preview-action-label">QRコードから参加する</span>
          </Button>
        </div>

        <footer className="home-preview-footer">
          <p>登録不要・すぐにはじめられます</p>
        </footer>
      </div>
      <HomeLaunch phase={launch} onSkip={skipLaunch} />
    </PageContainer>
  );
}
