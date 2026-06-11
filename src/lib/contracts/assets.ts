/**
 * Static assets embedded into the contract PDF, server-side.
 *
 * The Sevent logo (`public/logo.png`) is read from disk once and cached as a
 * base64 `data:` URI so `@react-pdf`'s <Image> can embed it without a network
 * fetch or a bundler-traced path. `outputFileTracingIncludes` in
 * `next.config.ts` pins the file into the traced output for standalone builds.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

let cachedLogo: string | null = null;

export function getSeventLogoDataUri(): string {
  if (cachedLogo) return cachedLogo;
  const bytes = readFileSync(path.join(process.cwd(), "public", "logo.png"));
  cachedLogo = `data:image/png;base64,${bytes.toString("base64")}`;
  return cachedLogo;
}
