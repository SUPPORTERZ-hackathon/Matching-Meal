
import { Plus, QrCode, ChevronRight } from "lucide-react";
import { AppLogo } from "@/components/common/app-logo";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import "./home-preview.css"

export function HomePreviewScreen() {
  return (
    <PageContainer header={null} className="home-preview-page">
      <div className="home-preview-content">
        <header className="home-preview-header">
          <AppLogo />
        </header>

        <section className="home-preview-hero" aria-label="料理のイメージ">
          <div className="home-preview-food home-preview-food-side" />
          <div className="home-preview-food home-preview-food-main">
            <span className="home-preview-heart">♥</span>
          </div>
          <div className="home-preview-food home-preview-food-side" />
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
          <Button variant="primary" size="meal" type="button" className="relative">
            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
              ルームを作成する
            </span>
            <ChevronRight aria-hidden="true" className="ml-auto" />
          </Button>

          <Button variant="outline" size="meal" type="button">
            <QrCode aria-hidden="true" />
            QRコードから参加する
          </Button>
        </div>

        <footer className="home-preview-footer">
          <p>登録不要・すぐにはじめられます</p>
        </footer>
      </div>
    </PageContainer>
  );
}
