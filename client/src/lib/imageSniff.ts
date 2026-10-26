export type DetectedImageType = "png" | "jpeg" | "webp";

/**
 * Sniffs the actual file bytes instead of trusting the client-supplied
 * `file.type`, which is attacker-controlled and easily spoofed. Also
 * excludes SVG on purpose — SVG can embed <script>, which is a stored-XSS
 * risk if the file is ever opened directly rather than rendered via <img>.
 */
export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/**
 * Pixel dimensions read from the image header (PNG IHDR, JPEG SOF, WEBP
 * VP8/VP8L/VP8X), without decoding the image. Null if the header can't be
 * read.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const type = detectImageType(bytes);
  const u16 = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const u16le = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const u24le = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);

  if (type === "png" && bytes.length >= 24) {
    const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    return { width, height };
  }
  if (type === "jpeg") {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      // Start-of-frame markers carry the size; C4 (DHT), C8 and CC (DAC) don't.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: u16(i + 5), width: u16(i + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (type === "webp" && bytes.length >= 30) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = (k: number) => bytes[21 + k];
      return { width: 1 + (((b(1) & 0x3f) << 8) | b(0)), height: 1 + (((b(3) & 0x0f) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6)) };
    }
    if (chunk === "VP8X") return { width: 1 + u24le(24), height: 1 + u24le(27) };
  }
  return null;
}
