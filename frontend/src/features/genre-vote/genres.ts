export type Genre = {
  readonly id: string;
  readonly name: string;
  readonly imagePath?: string;
  readonly appeal?: string;
};

export const GENRES: readonly Genre[] = [
  { id: "ramen", name: "ラーメン", imagePath: "/images/genres/01-ramen.jpg", appeal: "熱々の一杯を楽しもう" },
  { id: "sushi-seafood", name: "寿司・海鮮", imagePath: "/images/genres/02-sushi-seafood.jpg", appeal: "新鮮な海の幸を堪能" },
  { id: "yakiniku", name: "焼肉", imagePath: "/images/genres/03-yakiniku.jpg", appeal: "お肉を焼いて楽しもう" },
  { id: "steak-hamburg", name: "ステーキ・ハンバーグ", imagePath: "/images/genres/04-steak-hamburg.jpg", appeal: "肉の旨みを味わおう" },
  { id: "curry", name: "カレー", imagePath: "/images/genres/05-curry.jpg", appeal: "スパイス香る一皿" },
  { id: "soba-udon", name: "そば・うどん", imagePath: "/images/genres/06-soba-udon.jpg", appeal: "つるっと楽しむ一杯" },
  { id: "teishoku", name: "定食・食堂", imagePath: "/images/genres/07-teishoku.jpg", appeal: "ほっとする定番ごはん" },
  { id: "italian", name: "イタリアン", imagePath: "/images/genres/08-italian.jpg", appeal: "パスタとピザを満喫" },
  { id: "chinese", name: "中華料理", imagePath: "/images/genres/09-chinese.jpg", appeal: "アツアツ中華を堪能" },
  { id: "korean", name: "韓国料理", imagePath: "/images/genres/10-korean.jpg", appeal: "旨辛グルメを楽しもう" },
  { id: "asian", name: "アジア料理", imagePath: "/images/genres/11-asian.jpg", appeal: "異国の味を楽しもう" },
  { id: "hamburger", name: "ハンバーガー", imagePath: "/images/genres/12-burger.jpg", appeal: "豪快にかぶりつこう" },
  { id: "okonomiyaki-takoyaki", name: "お好み焼き・たこ焼き", imagePath: "/images/genres/13-okonomiyaki-takoyaki.jpg", appeal: "アツアツ粉ものを満喫" },
  { id: "nabe-shabushabu", name: "鍋・しゃぶしゃぶ", imagePath: "/images/genres/14-nabe-shabu.jpg", appeal: "みんなで囲む鍋料理" },
  { id: "izakaya", name: "居酒屋料理", imagePath: "/images/genres/15-izakaya.jpg", appeal: "おつまみを囲んで乾杯" },
  { id: "cafe", name: "カフェ", imagePath: "/images/genres/16-cafe.jpg", appeal: "甘いひとときを楽しもう" },
];
