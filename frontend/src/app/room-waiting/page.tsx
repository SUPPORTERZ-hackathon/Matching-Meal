import type { Metadata } from "next";
import { RoomWaitingScreen } from "@/features/room/room-waiting-screen";
import { isRoomId } from "@/features/room/room-data";

export const metadata: Metadata = { title: "友達を招待 | メシマッチ", robots: { index: false, follow: false } };
type RoomWaitingPageProps = { searchParams: Promise<{ room?: string | string[] }> };
export default async function RoomWaitingPage({ searchParams }: RoomWaitingPageProps) {
  const raw = (await searchParams).room;
  const roomId = typeof raw === "string" && isRoomId(raw) ? raw.toLowerCase() : undefined;
  return <RoomWaitingScreen key={roomId ?? "invalid"} roomId={roomId} />;
}
