import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  PERSONA_CREST_FILES,
  type PersonaId,
} from "@prostcounter/shared/wrapped/server";

import { FONT_FAMILY } from "./theme";

export interface CardFont {
  name: string;
  data: Buffer;
  weight: 800 | 900;
  style: "normal";
}

/** apps/web/public at runtime (process.cwd() is the Next app); tests point it at the repo. */
function assetsDir(): string {
  return process.env.SHARE_CARD_ASSETS_DIR ?? join(process.cwd(), "public");
}

let fontsPromise: Promise<CardFont[]> | null = null;

export function loadFonts(): Promise<CardFont[]> {
  fontsPromise ??= Promise.all(
    ([800, 900] as const).map(async (weight) => ({
      name: FONT_FAMILY,
      data: await readFile(
        join(assetsDir(), "wrapped", "fonts", `Nunito-${weight}.ttf`),
      ),
      weight,
      style: "normal" as const,
    })),
  ).catch((error: unknown) => {
    // Do not cache a failure: the next render tries again
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}

export async function loadCrest(personaId: PersonaId): Promise<string | null> {
  try {
    const png = await readFile(
      join(
        assetsDir(),
        "wrapped",
        "crests",
        `${PERSONA_CREST_FILES[personaId]}.png`,
      ),
    );
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
