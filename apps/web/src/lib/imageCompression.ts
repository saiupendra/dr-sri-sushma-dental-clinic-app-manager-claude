const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Resizes and re-encodes an image client-side before upload, to keep R2
 * storage (and the mandatory before-treatment photo on every note) from
 * ballooning. Skips anything the canvas can't reliably decode - HEIC (no
 * broad browser support for drawing it to a canvas) and non-images like
 * PDFs - and falls back to the original if compression didn't actually
 * shrink it (a already-small or already-optimized image can grow slightly
 * under JPEG re-encoding).
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Decoding failed for some reason - upload the original rather than block on it.
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
