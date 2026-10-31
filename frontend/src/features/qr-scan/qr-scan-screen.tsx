
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { AppHeader } from "@/components/common/app-header";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import styles from "./qr-scan.module.css";

export function QrScanScreen() {
  const router = useRouter();
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

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
                onClick={() => router.back()}
                aria-label="前の画面に戻る"
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
            参加するルームのQRコードを読み取ってください
          </p>

          <div className={styles.cameraArea}>
            <div className={styles.cameraIcon}>
              <Camera aria-hidden="true" />
            </div>

            {cameraUnavailable ? (
                <>
                <h2 className={styles.cameraTitle}>
                    カメラを利用できません
                </h2>

                <p className={styles.cameraDescription}>
                    カメラを利用できない場合は、LINEなどで共有されたURLから参加できます。
                </p>

                <Button
                    type="button"
                    variant="primary"
                    size="meal"
                    className={styles.cameraButton}
                    onClick={() => setCameraUnavailable(false)}
                >
                    もう一度試す
                </Button>
                </>
            ) : (
                <>
                <h2 className={styles.cameraTitle}>
                    カメラを起動してください
                </h2>

                <p className={styles.cameraDescription}>
                    QRコードの読み取りにのみ使用します
                </p>

                <Button
                    type="button"
                    variant="primary"
                    size="meal"
                    className={styles.cameraButton}
                    onClick={() => setCameraUnavailable(true)}
                >
                    カメラを許可する
                </Button>
                </>
            )}
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
