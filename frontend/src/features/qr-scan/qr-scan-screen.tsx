
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import styles from "./qr-scan.module.css";

export function QrScanScreen() {
  const router = useRouter();

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
        <section className={styles.content}>
          <p className={styles.kicker}>QR SCAN</p>

          <h1 className={styles.title}>ルームに参加</h1>

          <p className={styles.description}>
            スマートフォンの標準カメラで招待QRコードを読み取ってください
          </p>

          <div className={styles.cameraArea}>
            <div className={styles.cameraIcon}>
              <Camera aria-hidden="true" />
            </div>

            <h2 className={styles.cameraTitle}>アプリ内の読み取りは準備中です</h2>
            <p className={styles.cameraDescription}>標準カメラでQRコードを開くか、LINEなどで共有された招待URLを開くと、同じニックネーム入力画面へ進めます。</p>
            <Button type="button" variant="primary" size="meal" className={styles.cameraButton} disabled>QR読取は準備中</Button>
        </div>

          <button
            type="button"
            className={styles.homeButton}
            onClick={() => router.push("/home-preview")}
          >
            <ArrowLeft aria-hidden="true" />
            ホームに戻る
          </button>
        </section>
      </PageContainer>
    </div>
  );
}
