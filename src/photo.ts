/**
 * BOLO photos are stored as base64 data URLs in a Dataverse memo column, which
 * caps out at 1,048,576 characters. Raw phone photos blow past that, so resize
 * and re-encode as JPEG until the encoded string fits.
 */
const MAX_DIMENSION = 1024;
const MAX_ENCODED_LENGTH = 900_000;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4];

/**
 * A BOLO can carry several photos, and all of them share one memo column. Cap
 * the count so the gallery stays scannable, and keep a little headroom under
 * the column limit for the JSON array's own punctuation.
 */
export const MAX_PHOTOS = 5;
export const PHOTO_BUDGET = 1_000_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file could not be read as an image."));
    image.src = dataUrl;
  });
}

export async function fileToStoredPhoto(file: File, budget = MAX_ENCODED_LENGTH): Promise<string> {
  const limit = Math.max(50_000, Math.min(budget, MAX_ENCODED_LENGTH));
  const original = await readAsDataUrl(file);
  let image: HTMLImageElement;
  try {
    image = await decodeImage(original);
  } catch {
    // Couldn't decode for resizing; keep the original if it already fits.
    if (original.length <= limit) return original;
    throw new Error("That photo could not be read. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return original.length <= limit ? original : tooLarge();
  }

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of QUALITY_STEPS) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.length <= limit) return encoded;
    }
    // Still too big at the lowest quality, so shrink the pixels as well. This
    // is what lets a fifth photo fit into the room the first four left.
    let width = canvas.width;
    let height = canvas.height;
    for (let attempt = 0; attempt < 4; attempt++) {
      width = Math.max(1, Math.round(width * 0.7));
      height = Math.max(1, Math.round(height * 0.7));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      const encoded = canvas.toDataURL("image/jpeg", 0.6);
      if (encoded.length <= limit) return encoded;
    }
  } catch {
    // Canvas export can be blocked in a sandboxed frame; fall back below.
  }

  if (original.length <= limit) return original;
  return tooLarge();
}

function tooLarge(): never {
  throw new Error("That photo is too large to attach. Try a smaller image.");
}

/**
 * Several photos share the single memo column. They are stored as a JSON array,
 * but records created before multi-photo support hold a bare data URL, so
 * parsing has to accept both shapes.
 */
export function parsePhotos(stored: string | null | undefined): string[] {
  const raw = (stored ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
      }
    } catch {
      // Malformed JSON: fall through and treat the whole value as one photo.
    }
  }
  return [raw];
}

export function serializePhotos(photos: string[]): string {
  const kept = photos.filter(Boolean).slice(0, MAX_PHOTOS);
  if (kept.length === 0) return "";
  return JSON.stringify(kept);
}
