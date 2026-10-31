import type { Metadata } from "next";
import { RoomJoinScreen } from "@/features/room/room-join-screen";

export const metadata: Metadata = { title: "ルームに参加 | メシマッチ", robots: { index: false, follow: false }, referrer: "no-referrer" };
type RoomJoinPageProps = { params: Promise<{ joinCode: string }> };
export default async function RoomJoinPage({ params }: RoomJoinPageProps) {
  const { joinCode } = await params;
  return <RoomJoinScreen key={joinCode} joinCode={joinCode} />;
}
