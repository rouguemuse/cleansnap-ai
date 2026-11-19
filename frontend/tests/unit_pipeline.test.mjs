import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blurAlphaChannel,
  morphAlphaChannel,
  decontaminateForegroundRgb,
  applyMaskRefinements,
  refineAlphaWithHighResEdges
} from '../src/lib/mitSegmentationEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

test('Unit 1: morphAlphaChannel expands (+px) and contracts (-px) alpha masks accurately', () => {
  const w = 11;
  const h = 11;
  const mask = new Uint8ClampedArray(w * h);
  // 3x3 square of 255 in the center (x=4..6, y=4..6)
  for (let y = 4; y <= 6; y++) {
    for (let x = 4; x <= 6; x++) {
      mask[y * w + x] = 255;
    }
  }

  const expanded = morphAlphaChannel(mask, w, h, 1);
  assert.equal(expanded[3 * w + 5], 255, 'Expanded mask should reach y=3, x=5');
  assert.equal(expanded[2 * w + 5], 0, 'Expanded mask by 1px should not reach y=2');

  const contracted = morphAlphaChannel(mask, w, h, -1);
  assert.equal(contracted[5 * w + 5], 255, 'Center pixel (5,5) remains 255 after 1px erosion');
  assert.equal(contracted[4 * w + 5], 0, 'Boundary pixel (5,4) eroded to 0');
});

test('Unit 2: blurAlphaChannel feathers hard binary transitions smoothly without NaN or clipping errors', () => {
  const w = 19;
  const h = 19;
  const mask = new Uint8ClampedArray(w * h);
  for (let y = 4; y <= 14; y++) {
    for (let x = 4; x <= 14; x++) {
      mask[y * w + x] = 255;
    }
  }

  const blurred = blurAlphaChannel(mask, w, h, 2);
  assert.equal(blurred[9 * w + 9], 255, 'Deep interior remains fully opaque');
  assert.equal(blurred[0], 0, 'Far corner remains fully transparent');
  const edgeVal = blurred[4 * w + 9];
  assert.ok(edgeVal > 20 && edgeVal < 245, `Boundary pixel should be feathered (got ${edgeVal})`);
});

test('Unit 3: decontaminateForegroundRgb removes background color bleed on semi-transparent edge pixels', () => {
  const w = 8;
  const h = 8;
  const origRgba = new Uint8ClampedArray(w * h * 4);
  const alphaMask = new Uint8ClampedArray(w * h);

  // Interior subject (x=3..5, y=3..5) is bright crimson (220, 20, 30), alpha=255
  // Semi-transparent edge (x=2, y=4) has green background bleed (20, 200, 20), alpha=100
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p = idx * 4;
      if (x >= 3 && x <= 5 && y >= 3 && y <= 5) {
        origRgba[p] = 220;
        origRgba[p + 1] = 20;
        origRgba[p + 2] = 30;
        origRgba[p + 3] = 255;
        alphaMask[idx] = 255;
      } else if (x === 2 && y === 4) {
        origRgba[p] = 20;
        origRgba[p + 1] = 200;
        origRgba[p + 2] = 20;
        origRgba[p + 3] = 100;
        alphaMask[idx] = 100;
      }
    }
  }

  const cleaned = decontaminateForegroundRgb(origRgba, alphaMask, w, h, 1.0);
  const edgeP = (4 * w + 2) * 4;
  assert.ok(cleaned[edgeP] > 100, `Edge R should shift toward crimson foreground (got ${cleaned[edgeP]})`);
  assert.ok(cleaned[edgeP + 1] < 130, `Edge G bleed should be suppressed (got ${cleaned[edgeP + 1]})`);
  assert.equal(cleaned[edgeP + 3], 100, 'Edge alpha is preserved');
  assert.equal(cleaned[0], 0, 'Zero-alpha pixels have zeroed RGB');
});

test('Unit 4: refineAlphaWithHighResEdges upsamples 320x320 saliency map with center-aligned coordinates', () => {
  const prob320 = new Float32Array(320 * 320);
  for (let y = 80; y < 240; y++) {
    for (let x = 80; x < 240; x++) {
      prob320[y * 320 + x] = 0.96;
    }
  }
  const w = 64;
  const h = 64;
  const origRgba = new Uint8ClampedArray(w * h * 4);
  const refined = refineAlphaWithHighResEdges(prob320, origRgba, w, h);

  assert.equal(refined.length, w * h);
  assert.equal(refined[32 * w + 32], 255, 'Center of subject is opaque (255)');
  assert.equal(refined[2 * w + 2], 0, 'Outer background corner is transparent (0)');
});

test('Unit 5: applyMaskRefinements integrates expand, feather, and decontamination non-destructively', () => {
  const w = 12;
  const h = 12;
  const origRgba = new Uint8ClampedArray(w * h * 4).fill(180);
  const baseAlpha = new Uint8ClampedArray(w * h);
  for (let y = 4; y <= 7; y++) {
    for (let x = 4; x <= 7; x++) {
      baseAlpha[y * w + x] = 255;
    }
  }
  const copyBefore = new Uint8ClampedArray(baseAlpha);
  const { rgba, alpha } = applyMaskRefinements(origRgba, baseAlpha, w, h, {
    expandPx: 1,
    featherPx: 1,
    decontaminate: true,
    decontaminateStrength: 0.85
  });

  assert.deepEqual(baseAlpha, copyBefore, 'Input baseAlpha must not be mutated');
  assert.equal(rgba.length, w * h * 4);
  assert.equal(alpha.length, w * h);
  assert.equal(alpha[5 * w + 5], 255);
});

test('Unit 6: All required public studio backdrops, showcase cutouts, ONNX model, and Store PWA assets exist', () => {
  const requiredFiles = [
    'manifest.webmanifest',
    'sw.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
    'models/u2netp.onnx',
    'backdrops/green_screen_studio.jpg',
    'backdrops/cork_bulletin_board.jpg',
    'backdrops/slate_chalkboard.jpg',
    'backdrops/sunny_park_lawn.jpg',
    'samples/figure_greenscreen_before.jpg',
    'samples/figure_greenscreen_cutout.webp',
    'samples/tropical_slide_before.jpg',
    'samples/tropical_slide_cutout.webp',
    'samples/wax_letter_before.jpg',
    'samples/wax_letter_cutout.webp',
    'samples/red_coat_before.jpg',
    'samples/red_coat_cutout.webp',
    'samples/graphic_umbrella_before.jpg',
    'samples/graphic_umbrella_cutout.webp',
    'samples/sports_coupe_before.jpg',
    'samples/sports_coupe_cutout.webp'
  ];

  for (const rel of requiredFiles) {
    const full = path.join(publicDir, rel);
    assert.ok(fs.existsSync(full), `Missing required asset: ${rel}`);
    const stat = fs.statSync(full);
    assert.ok(stat.size > 500, `Asset ${rel} is unexpectedly small (${stat.size} bytes)`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
});
