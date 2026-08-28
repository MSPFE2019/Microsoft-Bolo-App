/**
 * BOLO photos are stored as base64 data URLs in a Dataverse memo column, which
 * caps out at 1,048,576 characters. Raw phone photos blow past that, so resize
 * and re-encode as JPEG until the encoded string fits.
 */
const MAX_DIMENSION = 1024;
const MAX_ENCODED_LENGTH = 900_000;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    image.src = url;
  });
}

export async function fileToStoredPhoto(file: File): Promise<string> {
  const image = await loadImage(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the selected photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of QUALITY_STEPS) {
    const encoded = canvas.toDataURL("image/jpeg", quality);
    if (encoded.length <= MAX_ENCODED_LENGTH) return encoded;
  }

  throw new Error("That photo is too large to attach. Try a smaller image.");
}
