import type { Metadata } from "next";
import { QrScanScreen } from "@/features/qr-scan/qr-scan-screen";

export const metadata: Metadata = {
  title: "QRコードから参加 | メシマッチ",
  description: "QRコードを読み取ってルームに参加します。",
};

export default function QrScanPage() {
  return <QrScanScreen />;
}