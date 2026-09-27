// FILE: src/verify/visualRegression.ts
import { inflateSync } from "node:zlib";
export interface Frame { width: number; height: number; data: Uint8Array }
export interface PixelDiff { difference: number; changedPixels: number; totalPixels: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } | undefined }
export interface Viewport { width: number; height: number; deviceScaleFactor: number }
export interface ScreenshotOptions { route: string; viewport: Viewport; fullPage?: boolean }
export interface JourneyStep { action: "goto" | "click" | "type" | "expect" | "screenshot"; selector?: string; text?: string; timeoutMs?: number }
export interface PlaywrightJourney { name: string; steps: JourneyStep[]; budgetMs: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function diffFrames(before: Frame, after: Frame, opts: { threshold?: number; blurRadius?: number } = {}): PixelDiff {
  if (before.width !== after.width || before.height !== after.height || before.data.length !== after.data.length) throw new Error("Frames must have identical dimensions");
  const threshold = opts.threshold ?? 24;
  const blur = Math.max(0, Math.min(4, Math.floor(opts.blurRadius ?? 1)));
  const { width, height, data } = before; const dataA = before.data, dataB = after.data;
  const changed = new Uint8Array(data.length); let changedPixels = 0;
  for (let p = 0; p < data.length; p += 4) {
    const a = dataA[p], b = dataB[p], g = dataB[p + 1], r = dataB[p + 2];
    const delta = Math.max(Math.abs(a - r), Math.abs(a - g), Math.abs(a - b));
    if (delta > threshold) { changedPixels++; changed[p] = 1; }
  }
  if (blur > 0 && changedPixels > 0) { changedPixels = applyMorphology(changed, data.length, width, blur); }
  const totalPixels = data.length / 4;
  let bounds: PixelDiff["bounds"];
  if (changedPixels) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!changed[(y * width + x) * 4]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    bounds = { minX, minY, maxX, maxY };
  }
  return { difference: totalPixels ? changedPixels / totalPixels : 0, changedPixels, totalPixels, bounds };
}

function applyMorphology(mask: Uint8Array, length: number, width: number, radius: number): number {
  const height = length / 4 / width;
  const origin = mask.slice(); let count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let flagged = false;
    for (let dy = -radius; dy <= radius && !flagged; dy++) for (let dx = -radius; dx <= radius && !flagged; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (origin[(ny * width + nx) * 4]) flagged = true;
    }
    if (flagged) { mask[(y * width + x) * 4] = 1; count++; }
  }
  return count;
}

export async function captureScreenshots(route: string, opts: ScreenshotOptions & { baseUrl: string; executablePath?: string }): Promise<Frame> {
  const { baseUrl, route: pathname, viewport, fullPage, executablePath } = opts;
  let playwright: typeof import("playwright");
  try { playwright = await import("playwright"); } catch (error) { throw new Error(`Playwright is required for screenshot capture: ${String(error)}`); }
  const browser = await playwright.chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
    await page.goto(new URL(pathname, baseUrl).toString(), { waitUntil: "networkidle", timeout: 30_000 });
    const buffer = await page.screenshot({ fullPage: fullPage ?? false });
    return parsePngPixels(buffer as Buffer);
  } finally { await browser.close(); }
}

function parsePngPixels(buffer: Buffer): Frame {
  const chunks: Array<{ type: string; data: Buffer }> = [];
  for (let p = 8; p < buffer.length; ) { const length = buffer.readUInt32BE(p); chunks.push({ type: buffer.toString("ascii", p + 4, p + 8), data: buffer.subarray(p + 8, p + 8 + length) }); p += 8 + length + 4; }
  const ihdr = chunks.find((c) => c.type === "IHDR")?.data;
  if (!ihdr) throw new Error("PNG IHDR chunk not found");
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), bitDepth = ihdr[8], colorType = ihdr[9];
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  if (colorType !== 2 && colorType !== 6) throw new Error(`Unsupported PNG color type ${colorType}`);
  const bpp = 3 + (colorType === 6 ? 1 : 0);
  const idat = chunks.filter((c) => c.type === "IDAT").map((c) => c.data).reduce((a, b) => Buffer.concat([a, b]));
  const bytes = inflateSync(idat);
  const stride = width * bpp;
  const output = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = bytes[pos++]; const line = bytes.subarray(pos, pos + stride); pos += stride;
    const raw = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? raw[x - bpp] : 0, up = prev[x], upLeft = x >= bpp ? prev[x - bpp] : 0;
      let value = line[x];
      switch (filter) {
        case 1: value = (value + left) & 0xff; break;
        case 2: value = (value + up) & 0xff; break;
        case 3: value = (value + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: { const base = left + up - upLeft; const pa = Math.abs(base - left), pb = Math.abs(base - up), pc = Math.abs(base - upLeft); const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft; value = (value + predictor) & 0xff; break; }
        default: break;
      }
      raw[x] = value;
    }
    for (let x = 0; x < width; x++) { const src = x * bpp; const dst = (y * width + x) * 4; output[dst] = raw[src]; output[dst + 1] = raw[src + 1]; output[dst + 2] = raw[src + 2]; output[dst + 3] = colorType === 6 ? raw[src + 3] : 255; }
    prev.set(raw);
  }
  return { width, height, data: output };
}

export function regressionGate(diff: PixelDiff, threshold: number) {
  const reasons: string[] = [];
  if (diff.difference > threshold) reasons.push(`Visual change ${(diff.difference * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}%${diff.bounds ? ` (region ${diff.bounds.minX},${diff.bounds.minY}..${diff.bounds.maxX},${diff.bounds.maxY})` : ""}`);
  return { passed: reasons.length === 0, reasons };
}

export function sampleFrame(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Frame { const data = new Uint8Array(width * height * 4); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const [r, g, b, a] = fill(x, y); const p = (y * width + x) * 4; data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = a; } return { width, height, data }; }