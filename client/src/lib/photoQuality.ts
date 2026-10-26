// Quick checks on an ID photo before it's sent, run on the phone: too dark,
// too bright, or blurry. They catch most unreadable photos so the farmer can
// retake them right away; staff still judge what gets through.

export interface Pixels {
  width: number;
  height: number;
  // RGBA, as in ImageData.
  data: Uint8ClampedArray;
}

export type PhotoProblem = "too_dark" | "too_bright" | "blurry";

export const PROBLEM_MESSAGES: Record<PhotoProblem, string> = {
  too_dark: "This photo is too dark. Move to better light and retake it.",
  too_bright: "This photo is washed out. Avoid direct light or glare and retake it.",
  blurry: "This photo looks blurry. Hold the phone steady and retake it.",
};

// Mean brightness (0–255) outside this range is too dark or too bright.
const MIN_BRIGHTNESS = 60;
const MAX_BRIGHTNESS = 225;
// Variance of the Laplacian below this reads as blurry, measured on a copy
// about 640 px wide. Sharp phone photos of a card measure well above it.
export const BLUR_THRESHOLD = 35;

/** Luminance (0–255) per pixel. */
export function toGray({ width, height, data }: Pixels): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return gray;
}

export function meanBrightness(gray: Float32Array): number {
  let sum = 0;
  for (const v of gray) sum += v;
  return gray.length ? sum / gray.length : 0;
}

/** Variance of the 4-neighbour Laplacian: high for crisp edges, low for blur. */
export function sharpness(gray: Float32Array, width: number, height: number): number {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function assessPhoto(pixels: Pixels): { problems: PhotoProblem[]; brightness: number; sharpness: number } {
  const gray = toGray(pixels);
  const brightness = meanBrightness(gray);
  const sharp = sharpness(gray, pixels.width, pixels.height);
  const problems: PhotoProblem[] = [];
  if (brightness < MIN_BRIGHTNESS) problems.push("too_dark");
  else if (brightness > MAX_BRIGHTNESS) problems.push("too_bright");
  if (sharp < BLUR_THRESHOLD) problems.push("blurry");
  return { problems, brightness, sharpness: sharp };
}
