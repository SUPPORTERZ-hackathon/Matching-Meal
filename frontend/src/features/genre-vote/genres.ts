export type Genre = {
  readonly id: string;
  readonly name: string;
  readonly imagePath?: string;
};

export const GENRES: readonly Genre[] = [
  { id: "ramen", name: "ラーメン" },
  { id: "sushi-seafood", name: "寿司・海鮮" },
  { id: "yakiniku", name: "焼肉" },
  { id: "steak-hamburg", name: "ステーキ・ハンバーグ" },
  { id: "curry", name: "カレー" },
  { id: "soba-udon", name: "そば・うどん" },
  { id: "teishoku", name: "定食・食堂" },
  { id: "italian", name: "イタリアン" },
  { id: "chinese", name: "中華料理" },
  { id: "korean", name: "韓国料理" },
  { id: "asian", name: "アジア料理" },
  { id: "hamburger", name: "ハンバーガー" },
  { id: "okonomiyaki-takoyaki", name: "お好み焼き・たこ焼き" },
  { id: "nabe-shabushabu", name: "鍋・しゃぶしゃぶ" },
  { id: "izakaya", name: "居酒屋料理" },
  { id: "cafe", name: "カフェ" },
];
