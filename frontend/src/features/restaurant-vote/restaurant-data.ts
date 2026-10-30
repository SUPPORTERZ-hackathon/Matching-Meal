export type RestaurantCandidate = {
  readonly id: string;
  readonly name: string;
  readonly photoUrl?: string;
  readonly openingHours?: string;
  readonly closedDays?: string;
  readonly dinnerBudget?: string;
  readonly access?: string;
  readonly stationName?: string;
  readonly detailUrl?: string;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly source: "mock" | "hotpepper";
};

// 将来の変換境界で使用する公式フィールドの部分型。取得処理/API契約ではない。
export type HotPepperShopFields = {
  readonly id: string;
  readonly name: string;
  readonly photo?: { readonly pc?: { readonly l?: string | null; readonly m?: string | null } | null } | null;
  readonly open?: string | null;
  readonly close?: string | null;
  readonly budget?: { readonly average?: string | null; readonly name?: string | null } | null;
  readonly access?: string | null;
  readonly mobile_access?: string | null;
  readonly station_name?: string | null;
  readonly urls?: { readonly pc?: string | null } | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
};

const HOTPEPPER_HOSTS = new Set(["www.hotpepper.jp", "hotpepper.jp"]);
const SHOP_PATH = /^\/strJ\d+\//;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function text(value?: string | null): string | undefined {
  return value?.trim() || undefined;
}

export function safeRestaurantDetailUrl(value?: string | null): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !HOTPEPPER_HOSTS.has(url.hostname) || !SHOP_PATH.test(url.pathname)) return;
    return url.href;
  } catch { return; }
}

export function safeRestaurantPhotoUrl(value?: string | null): string | undefined {
  const path = text(value);
  if (!path || path.includes("\\")) return;
  if (/^\/(restaurants|genres)\/[^?#]+$/.test(path) && !path.split("/").includes("..")) return path;
  try {
    const url = new URL(path);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { return; }
}

export function toRestaurantCandidate(shop: HotPepperShopFields): RestaurantCandidate {
  const coordinates = typeof shop.lat === "number" && typeof shop.lng === "number"
    && Number.isFinite(shop.lat) && Number.isFinite(shop.lng)
    && Math.abs(shop.lat) <= MAX_LATITUDE && Math.abs(shop.lng) <= MAX_LONGITUDE
    ? { latitude: shop.lat, longitude: shop.lng } : undefined;
  return {
    id: shop.id.trim(), name: shop.name.trim(),
    photoUrl: safeRestaurantPhotoUrl(shop.photo?.pc?.l) ?? safeRestaurantPhotoUrl(shop.photo?.pc?.m),
    openingHours: text(shop.open), closedDays: text(shop.close),
    dinnerBudget: text(shop.budget?.average) ?? text(shop.budget?.name),
    access: text(shop.mobile_access) ?? text(shop.access), stationName: text(shop.station_name),
    detailUrl: safeRestaurantDetailUrl(shop.urls?.pc), coordinates, source: "hotpepper",
  };
}

export function hasValidRestaurantCandidates(restaurants: readonly RestaurantCandidate[]): boolean {
  return restaurants.every((restaurant) => restaurant.id.trim() !== "" && restaurant.name.trim() !== "")
    && new Set(restaurants.map((restaurant) => restaurant.id)).size === restaurants.length;
}
