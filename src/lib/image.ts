/**
 * Browser-side photo compression (PRD §14: photos compressed in the browser
 * before upload). Drop-off, damage and release photos must stay small for
 * weak networks: target ≤ 200 KB.
 *
 * Browser only (uses createImageBitmap and canvas).
 */

export type CompressOptions = {
  /** Upper bound for the output size in bytes. Default 200 KB. */
  maxBytes?: number;
  /** Longest side in pixels before quality steps start. Default 1280. */
  maxDimension?: number;
};

const START_QUALITY = 0.82;
const MIN_QUALITY = 0.45;
const QUALITY_STEP = 0.08;
const SHRINK = 0.8;
const MIN_DIMENSION = 480;

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the photo.")),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(
  input: Blob,
  { maxBytes = 200_000, maxDimension = 1280 }: CompressOptions = {},
): Promise<Blob> {
  // "from-image" applies the EXIF rotation phones store with the photo.
  const bitmap = await createImageBitmap(input, {
    imageOrientation: "from-image",
  });
  try {
    let longest = Math.min(maxDimension, Math.max(bitmap.width, bitmap.height));
    let best: Blob | null = null;

    while (true) {
      const scale = longest / Math.max(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (let q = START_QUALITY; q >= MIN_QUALITY - 1e-9; q -= QUALITY_STEP) {
        const blob = await toJpeg(canvas, q);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) return blob;
      }

      if (longest <= MIN_DIMENSION) {
        if (!best) throw new Error("Could not encode the photo.");
        return best;
      }
      longest = Math.max(MIN_DIMENSION, Math.round(longest * SHRINK));
    }
  } finally {
    bitmap.close();
  }
}

/** "183 KB", "1.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
