import type { Metadata, Viewport } from "next";
import { Kiwi_Maru, Noto_Sans_JP } from "next/font/google";
import { APP_APPLE_ICON_SIZE, APP_FAVICON_SIZE, APP_PWA } from "@/features/pwa/pwa-config";
import { TapParticles } from "@/components/common/tap-particles";
import { AudioProvider } from "@/features/audio/audio-provider";
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
  themeColor: APP_PWA.themeColor,
};

// manifest.tsのファイル規約が、全ルートへ共通のmanifestリンクを出力する。
export const metadata: Metadata = {
  title: APP_PWA.name,
  description: APP_PWA.description,
  applicationName: APP_PWA.name,
  appleWebApp: { capable: true, title: APP_PWA.name, statusBarStyle: "default" },
  icons: {
    icon: [{ url: `${APP_PWA.iconPath}/favicon-32.png`, sizes: `${APP_FAVICON_SIZE}x${APP_FAVICON_SIZE}`, type: "image/png" }],
    apple: [{ url: `${APP_PWA.iconPath}/apple-180.png`, sizes: `${APP_APPLE_ICON_SIZE}x${APP_APPLE_ICON_SIZE}`, type: "image/png" }],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja" className={`${notoSansJp.variable} ${kiwiMaru.variable}`}><body><AudioProvider>{children}</AudioProvider><TapParticles /></body></html>;
}
