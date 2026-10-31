
import type { Metadata } from "next";
import { RoomJoinScreen } from "@/features/room-join/room-join-screen";

export const metadata: Metadata = {
  title: "ルームに参加 | メシマッチ",
  description: "招待されたルームに参加します。",
};

export default function RoomJoinPage() {
  return <RoomJoinScreen />;
}
