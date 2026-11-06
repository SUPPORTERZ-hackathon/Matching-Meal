
import type { Metadata } from "next";
import { RoomCreateScreen } from "@/features/room-create/room-create-screen";

export const metadata: Metadata = {
  title: "ルーム作成 | メシマッチ",
  description: "ニックネームやお店を探す場所を設定して、食事選びのルームを作成します。",
};

export default function RoomCreatePage() {
  return <RoomCreateScreen />;
}
