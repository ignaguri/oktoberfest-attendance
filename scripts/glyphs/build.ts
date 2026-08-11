/*
  Turns raw achievement glyph renders into the shipped 256px PNGs.

  Usage:
    pnpm glyphs:build --src ~/Temp/glyphs                 # rebuild the whole set
    pnpm glyphs:build --src ~/Temp/glyphs --only masskrug # just one glyph
    pnpm glyphs:build --src ~/Temp/glyphs --out /tmp/preview --masters /tmp/2048

  By default the output is written into both app asset folders. Pass --out to
  write somewhere else instead, which is what you want while iterating.

  Requires ImageMagick 7 (`magick`) on PATH: brew install imagemagick

  See ./README.md for what the pipeline does and why.
*/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dekey } from "./dekey";
import { fit } from "./fit";
import { OVERRIDES } from "./overrides";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APP_TARGETS = [
  "apps/web/public/achievements/glyphs",
  "apps/mobile/assets/achievements/glyphs",
];

// 2048x2048 RGBA is 16MB, well past execFileSync's 1MB default.
const MAX_BUFFER = 256 * 1024 * 1024;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const src = flag("src");
const only = flag("only");
const outDir = flag("out");
const mastersDir = flag("masters");
const size = Number(flag("size") ?? 256);
// 83% of the canvas, leaving the breathing room the badge layouts expect.
const inner = Number(flag("inner") ?? Math.round(size * 0.828));
const colors = Number(flag("colors") ?? 48);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function magick(args: string[], input?: Buffer): Buffer {
  return execFileSync("magick", args, { input, maxBuffer: MAX_BUFFER });
}

function main() {
  if (!src) {
    fail(
      "--src <dir> is required: the folder of raw renders, one <glyph-id>.png each.\n" +
        "These are large and not tracked in the repo; see scripts/glyphs/README.md.",
    );
  }
  try {
    magick(["-version"]);
  } catch {
    fail("ImageMagick 7 is required and `magick` was not found. brew install imagemagick");
  }

  const srcDir = path.resolve(src);
  if (!fs.existsSync(srcDir)) fail(`No such directory: ${srcDir}`);
  const names = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => f.slice(0, -4))
    .filter((id) => !only || id === only)
    .sort();
  if (names.length === 0) {
    fail(only ? `No ${only}.png in ${srcDir}` : `No .png files in ${srcDir}`);
  }

  const targets = outDir ? [path.resolve(outDir)] : APP_TARGETS.map((t) => path.join(REPO_ROOT, t));
  for (const dir of targets) fs.mkdirSync(dir, { recursive: true });
  if (mastersDir) fs.mkdirSync(path.resolve(mastersDir), { recursive: true });

  for (const id of names) {
    const file = path.join(srcDir, `${id}.png`);
    const [w, h] = magick([file, "-format", "%w %h", "info:"])
      .toString()
      .trim()
      .split(/\s+/)
      .map(Number);

    const raw = magick([file, "-depth", "8", "rgba:-"]);
    const stats = dekey(raw, w, h, OVERRIDES[id] ?? {});

    if (mastersDir) {
      const master = path.join(path.resolve(mastersDir), `${id}.png`);
      magick(["-size", `${w}x${h}`, "-depth", "8", "rgba:-", "-strip", `PNG32:${master}`], raw);
    }

    const fitted = fit(raw, w, h, size, inner);
    const encoded = magick(
      [
        "-size",
        `${size}x${size}`,
        "-depth",
        "8",
        "rgba:-",
        "-strip",
        "-colors",
        String(colors),
        "-define",
        "png:compression-level=9",
        "PNG32:-",
      ],
      fitted.data,
    );
    for (const dir of targets) fs.writeFileSync(path.join(dir, `${id}.png`), encoded);

    const warn = stats.residuePct > 0.01 && !OVERRIDES[id]?.keep ? "  <-- residue, inspect" : "";
    console.log(
      `${id.padEnd(16)} tones ${stats.light}/${stats.dark}  cell ${stats.period}px  ` +
        `blobs ${stats.blobs}  reclaimed ${stats.reclaimed}  killed ${stats.killed}  ` +
        `${fitted.bbox[0]}x${fitted.bbox[1]} -> ${fitted.scaled[0]}x${fitted.scaled[1]}` +
        `  ${(encoded.length / 1024).toFixed(1)}KB${warn}`,
    );
  }

  console.log(`\nwrote ${names.length} glyph(s) to:`);
  for (const dir of targets) console.log(`  ${path.relative(REPO_ROOT, dir) || dir}`);
}

main();
