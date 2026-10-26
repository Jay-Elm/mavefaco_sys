import { describe, expect, it } from "vitest";
import { assessPhoto, BLUR_THRESHOLD, sharpness, toGray, type Pixels } from "./photoQuality";

function image(width: number, height: number, value: (x: number, y: number) => number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const v = value(x, y);
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

// Text-like detail: a fine checkerboard of light and dark, around mid-grey.
const crisp = (x: number, y: number) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 190 : 70);
// The same scene smeared out: a smooth gradient.
const smooth = (x: number) => 70 + (x / 200) * 120;

describe("photo quality", () => {
  it("passes a sharp, well-lit photo", () => {
    expect(assessPhoto(image(200, 120, crisp)).problems).toEqual([]);
  });

  it("flags a blurry photo", () => {
    const blurred = image(200, 120, smooth);
    expect(sharpness(toGray(blurred), 200, 120)).toBeLessThan(BLUR_THRESHOLD);
    expect(assessPhoto(blurred).problems).toEqual(["blurry"]);
  });

  it("flags photos that are too dark or too bright", () => {
    expect(assessPhoto(image(200, 120, (x, y) => crisp(x, y) / 4)).problems).toContain("too_dark");
    expect(assessPhoto(image(200, 120, (x, y) => 200 + crisp(x, y) / 4)).problems).toContain("too_bright");
  });
});
