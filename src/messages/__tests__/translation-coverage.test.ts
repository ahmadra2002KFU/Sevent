// Regression guardrail: prevents copy-paste-English-into-AR regressions by
// failing if any Arabic leaf value equals its English counterpart (outside a
// narrow, justified skiplist). Also asserts that both locales have identical
// shape so we notice when a new EN key is added without an AR translation.

import { describe, expect, it } from "vitest";
import en from "../en.json";
import ar from "../ar.json";

type JsonLeaf = string | number | boolean | null;
type JsonValue = JsonLeaf | JsonValue[] | { [k: string]: JsonValue };

/** Paths explicitly allowed to share the same string across EN and AR. */
const SKIPLIST_EXACT = new Set<string>([
  // Email placeholder — cross-locale-friendly literal `you@company.sa`.
  "auth.signIn.emailPlaceholder",
  "auth.signUp.emailPlaceholder",
  "auth.signUp.supplier.emailPlaceholder",
  // `+966` international dialing code — identical in both locales (numeric literal).
  "auth.signUp.supplier.phoneCountryCode",
  // `5XXXXXXXX` Saudi mobile mask — numeric placeholder, locale-neutral.
  "auth.signUp.supplier.phonePlaceholder",
  // `{count}/{max}` numeric bio char counter — locale-neutral format.
  "supplier.onboarding.wizard.bioCharCounter",
  // Locale-name self-reference: "English" in the EN file, "العربية" in the AR file;
  // they are compared independently and their EN string (e.g. "English") is what
  // appears on both sides of the equality check only for the `en` key. The `ar`
  // key reads "العربية" on both sides. Either way, intentional.
  "languageSwitcher.en",
  "languageSwitcher.ar",
]);

/** Prefix patterns that are always allowed (slugs, routes, brand wordmarks). */
const SKIPLIST_PREFIX: string[] = [
  "brand.", // brand wordmarks are the same across locales
  "languageSwitcher.", // defensive; exact matches above already cover both entries
];

/** Regex matchers for EN values that should never be expected to translate. */
const SKIP_VALUE_PATTERNS: RegExp[] = [
  /^[—–\-\s]+$/u, // pure punctuation/whitespace like "—", "-", " "
  /^SAR\s*[\d.,]*$/u, // SAR currency labels
];

/** Paths whose leaf value is a structural identifier (URL, route, slug, etc.). */
function isStructuralPath(path: string): boolean {
  // Route paths under supplier.dashboard.*.Href, etc.
  if (path.endsWith("Href")) return true;
  // Static slug keys in landing.categories.fallback[*].slug
  if (path.endsWith(".slug")) return true;
  // URL-like path fields (e.g. landing.supplierShowcase.dashboard.path)
  if (path.endsWith(".path")) return true;
  // https:// import placeholder
  if (path.endsWith(".placeholder") && path.includes("importWebsite"))
    return true;
  return false;
}

function isStructuralValue(value: string): boolean {
  if (value === "Sevent") return true;
  if (value === "") return true;
  if (value === "https://") return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  if (value.startsWith("mailto:")) return true;
  if (value.startsWith("/")) return true; // absolute route
  if (value.includes("sevent.sa/")) return true; // bare URL string
  if (/^[\d.,\s-]+$/u.test(value)) return true; // pure numeric
  for (const re of SKIP_VALUE_PATTERNS) {
    if (re.test(value)) return true;
  }
  return false;
}

function isSkipped(path: string, enValue: string): boolean {
  if (SKIPLIST_EXACT.has(path)) return true;
  for (const prefix of SKIPLIST_PREFIX) {
    if (path.startsWith(prefix)) return true;
  }
  if (isStructuralPath(path)) return true;
  if (isStructuralValue(enValue)) return true;
  return false;
}

/**
 * Walks a JSON tree and yields [dottedPath, leafValue] pairs. Arrays are
 * indexed with `[n]` notation (e.g. `landing.how.steps[0].title`) so array
 * elements get unique paths.
 */
function* walkLeaves(
  node: JsonValue,
  prefix = "",
): Generator<[string, JsonLeaf]> {
  if (node === null || typeof node !== "object") {
    yield [prefix, node as JsonLeaf];
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      yield* walkLeaves(node[i] as JsonValue, `${prefix}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    yield* walkLeaves(value as JsonValue, nextPrefix);
  }
}

function collectLeaves(tree: JsonValue): Map<string, JsonLeaf> {
  const out = new Map<string, JsonLeaf>();
  for (const [path, value] of walkLeaves(tree)) {
    out.set(path, value);
  }
  return out;
}

describe("translation coverage", () => {
  const enLeaves = collectLeaves(en as JsonValue);
  const arLeaves = collectLeaves(ar as JsonValue);

  it("EN and AR have identical shape (same set of leaf paths)", () => {
    const enPaths = new Set(enLeaves.keys());
    const arPaths = new Set(arLeaves.keys());

    const missingInAr = [...enPaths].filter((p) => !arPaths.has(p)).sort();
    const extraInAr = [...arPaths].filter((p) => !enPaths.has(p)).sort();

    const failures: string[] = [];
    if (missingInAr.length > 0) {
      failures.push(
        `Missing in ar.json (${missingInAr.length}):\n  - ${missingInAr.join("\n  - ")}`,
      );
    }
    if (extraInAr.length > 0) {
      failures.push(
        `Extra in ar.json (${extraInAr.length}):\n  - ${extraInAr.join("\n  - ")}`,
      );
    }
    expect(failures, failures.join("\n\n")).toHaveLength(0);
  });

  it("no AR string leaf is identical to its EN counterpart (outside skiplist)", () => {
    const offenders: string[] = [];

    for (const [path, enValue] of enLeaves) {
      if (typeof enValue !== "string") continue;
      const arValue = arLeaves.get(path);
      if (typeof arValue !== "string") continue;
      if (enValue !== arValue) continue;
      if (isSkipped(path, enValue)) continue;
      offenders.push(path);
    }

    offenders.sort();
    const msg =
      offenders.length === 0
        ? ""
        : `The following AR leaves still equal their EN counterpart (copy-paste regression):\n  - ${offenders.join(
            "\n  - ",
          )}`;
    expect(offenders, msg).toHaveLength(0);
  });
});
