import type { Metadata, Viewport } from "next";
import { Kiwi_Maru, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});
const kiwiMaru = Kiwi_Maru({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  variable: "--font-kiwi-maru",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = { title: "Matching Meal | 開発環境", description: "Matching Mealの開発環境接続確認" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja" className={`${notoSansJp.variable} ${kiwiMaru.variable}`}><body>{children}</body></html>;
}
