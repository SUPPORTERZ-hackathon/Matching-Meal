import type { Metadata, Viewport } from "next";
import { GENRE_ICON_PATH, GENRE_MANIFEST_PATH, GENRE_THEME_COLOR, PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { GenreVoteWaitingScreen } from "@/features/genre-vote-waiting/genre-vote-waiting-screen";
import { MOCK_WAITING_PARTICIPANTS } from "@/features/genre-vote-waiting/prototype-data";

export const metadata: Metadata = {
  title: "ジャンル投票待機 | メシマッチ",
  description: "みんなのジャンル投票の完了を待つUIプロトタイプ。",
  manifest: GENRE_MANIFEST_PATH,
  appleWebApp: { capable: true, title: "メシマッチ", statusBarStyle: "default" },
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

export default function GenreVoteWaitingPage() {
  // API連携時はこの境界でルームIDと参加者の表示データを供給する。
  return <GenreVoteWaitingScreen participants={MOCK_WAITING_PARTICIPANTS} roomId={PROTOTYPE_ROOM_ID} />;
}
