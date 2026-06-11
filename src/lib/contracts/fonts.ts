/**
 * Server-side font registration for the contract PDF.
 *
 * The contract renders bilingual Arabic + English. `@react-pdf/renderer` ships
 * Helvetica for Latin text but has no Arabic-capable font, so we register the
 * Almarai family (the same TTFs the web UI loads via `next/font/local` in
 * `src/app/layout.tsx`). `@react-pdf/textkit` performs Arabic glyph shaping and
 * bidi reordering automatically once a font with Arabic coverage is registered
 * — no manual string reversal is needed.
 *
 * Registration uses `data:` base64 URIs read from disk at call time rather than
 * a bare filesystem path: the data URI is self-contained, so it does not depend
 * on the bundler tracing the TTF into the server-action bundle. The source TTFs
 * must still exist on disk at runtime — `outputFileTracingIncludes` in
 * `next.config.ts` pins them into the traced output for standalone builds.
 *
 * Registration is idempotent (guarded) because the contract pipeline runs once
 * per supplier confirmation and the server module may stay warm across calls.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const CONTRACT_ARABIC_FONT = "Almarai" as const;

const FONT_DIR = path.join(process.cwd(), "src", "app", "fonts");

let registered = false;

function fontDataUri(file: string): string {
  const base64 = readFileSync(path.join(FONT_DIR, file)).toString("base64");
  return `data:font/ttf;base64,${base64}`;
}

export function registerContractFonts(): void {
  if (registered) return;

  Font.register({
    family: CONTRACT_ARABIC_FONT,
    fonts: [
      { src: fontDataUri("Almarai-Light.ttf"), fontWeight: 300 },
      { src: fontDataUri("Almarai-Regular.ttf"), fontWeight: 400 },
      { src: fontDataUri("Almarai-Bold.ttf"), fontWeight: 700 },
      { src: fontDataUri("Almarai-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });

  // A legal document must never hyphenate (Arabic must not break mid-word, and
  // hyphenated English clauses read badly). Returning the word unchanged
  // disables @react-pdf's default Latin hyphenation globally for this runtime.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
