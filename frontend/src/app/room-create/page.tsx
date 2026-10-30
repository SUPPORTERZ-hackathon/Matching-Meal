
import type { Metadata, Viewport } from "next";
import { RoomCreateScreen } from "@/features/room-create/room-create-screen";

export const metadata: Metadata = {
  title: "ルーム作成 | メシマッチ",
  description: "ニックネームやお店を探す場所を設定して、食事選びのルームを作成します。",
  appleWebApp: {
    capable: true,
    title: "メシマッチ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RoomCreatePage() {
  return <RoomCreateScreen />;
}
