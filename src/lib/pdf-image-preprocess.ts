import { createCanvas, loadImage } from "@napi-rs/canvas";

/** Crop exam chrome and boost contrast for Tesseract (free, no external APIs). */
export async function preprocessPageForOcr(pngBuffer: Buffer): Promise<Buffer> {
  const img = await loadImage(pngBuffer);
  const w = img.width;
  const h = img.height;

  const cropTop = Math.floor(h * 0.1);
  const cropBottom = Math.floor(h * 0.07);
  const cropH = Math.max(1, h - cropTop - cropBottom);

  const canvas = createCanvas(w, cropH);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, cropTop, w, cropH, 0, 0, w, cropH);

  const imageData = ctx.getImageData(0, 0, w, cropH);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = ((gray - 128) * 1.35 + 128);
    gray = gray < 140 ? 0 : gray > 220 ? 255 : gray;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer("image/png");
}
