// 旧ジャンル投票PWAと同じID・画像URLを保ち、アプリ全体へ適用する。
export const APP_PWA_ICON_PATH = "/genre-vote/icons";
export const APP_PWA = {
  id: "/genre-vote",
  name: "メシマッチ",
  description: "みんなで投票して、今日のお店を決めよう。",
  startUrl: "/home-preview",
  scope: "/",
  manifestPath: "/manifest.webmanifest",
  iconPath: APP_PWA_ICON_PATH,
  themeColor: "#ED3B33",
  backgroundColor: "#FFFDFA",
} as const;

export const APP_ICON_SIZES = [192, 512] as const;
export const APP_APPLE_ICON_SIZE = 180;
export const APP_FAVICON_SIZE = 32;
