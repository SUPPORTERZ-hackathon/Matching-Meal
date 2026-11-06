import { BinaryBitmap, ChecksumException, FormatException, HybridBinarizer, NotFoundException, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import type { QrDecoder } from "./qr-scan-data";

// 読み取り開始時にだけ遅延ロードする。映像・解析結果は端末内で完結する。
export function createQrDecoder(): QrDecoder {
  const reader = new QRCodeReader();
  return ({ data, width, height }) => {
    const luminance = new Uint8ClampedArray(width * height);
    for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++, offset += 4) {
      luminance[pixel] = (data[offset] + data[offset + 1] * 2 + data[offset + 2]) / 4;
    }
    try {
      return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height))))?.getText();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException) return;
      throw error;
    } finally { reader.reset(); }
  };
}
