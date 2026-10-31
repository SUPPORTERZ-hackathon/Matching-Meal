
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoomJoinScreen } from "@/features/room/room-join-screen";
import { normalizeJoinCode } from "@/features/room/room-data";

export const metadata: Metadata = {
  title: "ルームに参加 | メシマッチ",
  description: "招待されたルームに参加します。",
};

type RoomJoinPageProps = { searchParams: Promise<{ joinCode?: string | string[] }> };
export default async function RoomJoinPage({ searchParams }: RoomJoinPageProps) {
  const raw = (await searchParams).joinCode;
  const code = typeof raw === "string" ? normalizeJoinCode(raw) : undefined;
  if (code) redirect(`/j/${encodeURIComponent(code)}`);
  return <RoomJoinScreen joinCode="" />;
}
