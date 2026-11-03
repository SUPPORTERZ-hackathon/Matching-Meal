"use client";

import { QrCode, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { getHomeFeaturedGenres } from "./home-food-data";
import { HomeFoodPhoto } from "./home-food-photo";
import "./home-preview.css"

export function HomePreviewScreen() {
  const router = useRouter();

  return (
    <PageContainer header={<AppHeader />} className="home-preview-page">
      <div className="home-preview-content">
        <section className="home-preview-hero" aria-label="料理のイメージ">
          {getHomeFeaturedGenres(GENRES).map(({ position, genre }) => (
            <div key={position} className={`home-preview-food ${position === "center" ? "home-preview-food-main" : "home-preview-food-side"}`} data-home-position={position}>
              <HomeFoodPhoto key={`${genre?.id}:${genre?.imagePath}`} genre={genre} featured={position === "center"} />
              {position === "center" && <span className="home-preview-heart">♥</span>}
            </div>
          ))}
        </section>

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
          <Button variant="primary" size="meal" type="button" onClick={() => router.push("/room-create")}>
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
    </PageContainer>
  );
}
