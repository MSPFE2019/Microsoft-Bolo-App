/**
 * BOLO photos are stored as base64 data URLs in a Dataverse memo column, which
 * caps out at 1,048,576 characters. Raw phone photos blow past that, so resize
 * and re-encode as JPEG until the encoded string fits.
 */
const MAX_DIMENSION = 1024;
const MAX_ENCODED_LENGTH = 900_000;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4];

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

export async function fileToStoredPhoto(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  let image: HTMLImageElement;
  try {
    image = await decodeImage(original);
  } catch {
    // Couldn't decode for resizing; keep the original if it already fits.
    if (original.length <= MAX_ENCODED_LENGTH) return original;
    throw new Error("That photo could not be read. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return original.length <= MAX_ENCODED_LENGTH ? original : tooLarge();
  }

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of QUALITY_STEPS) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.length <= MAX_ENCODED_LENGTH) return encoded;
    }
  } catch {
    // Canvas export can be blocked in a sandboxed frame; fall back below.
  }

  if (original.length <= MAX_ENCODED_LENGTH) return original;
  return tooLarge();
}

function tooLarge(): never {
  throw new Error("That photo is too large to attach. Try a smaller image.");
}
