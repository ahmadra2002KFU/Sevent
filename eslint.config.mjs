import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// =============================================================================
// i18n guardrails — regression fences for the locale-leakage remediation.
//
// Each rule is paired with an inline justification. Allow-listed paths are
// kept narrow: the helpers that legitimately need raw `Intl` constructors or
// BCP-47 string literals live in three files and only three. Anything new
// must justify itself in a separate config override.
//
// ESLint flat config only allows ONE severity per rule per file path, so we
// keep all i18n fences at `error` severity in a single block. The deprecation
// rule for `formatHalalas` is documented as "soft" via per-call-site
// `eslint-disable-next-line` comments at out-of-scope call sites (contracts
// PDF / bookings / public package cards / supplier catalog / dispute detail
// — explicitly outside the RFQ remediation surface).
// =============================================================================

const i18nRestrictedSyntax = [
  // -------------------------------------------------------------------------
  // Pre-Stage-4 rules (kept from the original sweep). Documented so the
  // rationale isn't lost when the rule list grows.
  // -------------------------------------------------------------------------
  {
    // Stage-0 rule: pre-Stage-4 sweep banned `Intl.DateTimeFormat('en-SA')`
    // / `'ar-SA'`. Now subsumed by the general locale-tag-literal rule
    // below, but kept here for redundant clarity and a more specific
    // diagnostic message at this exact anti-pattern.
    selector:
      'NewExpression[callee.object.name="Intl"][callee.property.name="DateTimeFormat"] > Literal[value=/-SA$/]',
    message:
      "Do not hardcode `en-SA` / `ar-SA` in `Intl.DateTimeFormat`. Use `fmtDate` / `fmtDateTime` from `@/lib/domain/formatDate` and pass `locale`.",
  },
  {
    // Match ONLY the raw JSX render pattern `{x.name_en}` — not ternary /
    // logical wrappers that already handle locale branching. The combinator
    // `>` demands that the MemberExpression is a direct child of the JSX
    // expression container, so `{isAr ? x.name_ar : x.name_en}` and
    // `{categoryName(x, locale) || x.name_en}` are NOT matched.
    selector:
      'JSXExpressionContainer > MemberExpression[property.name=/^(name_en|parent_name_en)$/]',
    message:
      "Render localized category names via `categoryName(row, locale)` from `@/lib/domain/taxonomy` — do not render `.name_en` / `.parent_name_en` raw in JSX.",
  },
  {
    selector:
      'CallExpression[callee.name="eventFormT"] > TemplateLiteral[quasis.0.value.raw=/^eventType\\./]',
    message:
      "`eventFormT(`eventType.${slug}`)` is a dead lookup. Use `segmentNameFor(slug, locale)` from `@/lib/domain/segments`.",
  },

  // -------------------------------------------------------------------------
  // Stage-4 (I-28) guardrails.
  // -------------------------------------------------------------------------
  {
    // Ban `new Intl.DateTimeFormat(...)` everywhere outside the allow-list
    // helper files (`@/lib/domain/formatDate`, `@/lib/notifications/
    // templates/_shared/i18n.ts`). Those exist exactly to centralize
    // locale-aware date formatting; constructing the raw `Intl` formatter
    // elsewhere is how `"en-SA"` / `"en-GB"` literals regrow.
    selector:
      'NewExpression[callee.object.name="Intl"][callee.property.name="DateTimeFormat"]',
    message:
      "Construct `Intl.DateTimeFormat` only inside `@/lib/domain/formatDate` or notification `_shared/i18n.ts`. Elsewhere, use `fmtDate` / `fmtDateTime` / `fmtRelative` and pass `locale`.",
  },
  {
    // Same for `Intl.NumberFormat`. The locale-aware wrappers (`fmtNumber`,
    // `fmtPercent`, `formatMoney`) live in formatDate.ts / money.ts and
    // accept `locale`. Constructing the raw formatter inline is how Latin
    // digits regrow under Arabic locales.
    selector:
      'NewExpression[callee.object.name="Intl"][callee.property.name="NumberFormat"]',
    message:
      "Construct `Intl.NumberFormat` only inside `@/lib/domain/formatDate` or `@/lib/domain/money`. Use `fmtNumber` / `fmtPercent` / `formatMoney` everywhere else.",
  },
  {
    // String-literal BCP-47 tags like `"ar-SA"` / `"en-GB"` are how the
    // hardcoded-locale pattern survived previous sweeps. Banning these
    // literals catches BOTH `Intl.X("en-GB")` and
    // `date.toLocaleString("en-GB")` invocations everywhere they aren't
    // in an allow-listed helper.
    selector: 'Literal[value=/^(en-SA|ar-SA|en-GB|en-US)$/]',
    message:
      "BCP-47 locale tags belong in the locale helpers (`intlLocale` in `@/lib/domain/formatDate`, `intlLocaleFor` in notification `_shared/i18n.ts`, `money.ts`). Don't embed them at call sites — pass `locale` and let the helper translate.",
  },
  {
    // Cross-locale fallback `row.name_ar || row.name_en` (or the reverse).
    // This was the root cause of email notifications speaking the wrong
    // language when an Arabic recipient had `name_ar = null`. Use
    // `categoryName(row, locale)` / `segmentNameFor(slug, locale)` instead,
    // both of which guarantee a locale-pure result.
    selector:
      'LogicalExpression[operator="||"][left.property.name=/^name_(ar|en)$/][right.property.name=/^name_(ar|en)$/]',
    message:
      "Cross-locale fallback (`name_ar || name_en`) leaks the wrong language. Use `categoryName(row, locale)` from `@/lib/domain/taxonomy` or `segmentNameFor(slug, locale)` from `@/lib/domain/segments` — they return a locale-pure value.",
  },
  {
    // `.replace(/_/g, " ")` in a JSX expression is the canonical
    // "raw enum slug → human label" anti-pattern. The resulting label is
    // English-only and ignores the active locale. Use a translation key
    // map (`t(\`enum.${slug}\`)`) instead.
    selector:
      'JSXExpressionContainer CallExpression[callee.property.name="replace"][arguments.0.regex.pattern="_"][arguments.0.regex.flags=/g/][arguments.1.value=" "]',
    message:
      "Don't strip underscores from enum values in JSX. Add a translation key map and call `t(\\`namespace.${slug}\\`)` — the helper will pick the right locale.",
  },
  {
    // `formatHalalas(...)` is deprecated in favor of `formatMoney(halalas,
    // locale)` from `@/lib/domain/money`. The former defaults to `en-SA`
    // and emits Latin digits even when the user's locale is `ar`. RFQ
    // surfaces have been migrated; non-RFQ surfaces (contracts PDF,
    // bookings list/detail, public package cards, supplier catalog,
    // dispute detail) use targeted `eslint-disable-next-line` comments
    // pending a separate locale sweep.
    selector: 'CallExpression[callee.name="formatHalalas"]',
    message:
      "`formatHalalas` is locale-blind (always `en-SA`). Prefer `formatMoney(halalas, locale)` from `@/lib/domain/money`.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Helpers that legitimately need raw `Intl` constructors / BCP-47
      // string literals / `formatHalalas`. Everything else must route
      // through one of these three files.
      "src/lib/domain/formatDate.ts",
      "src/lib/domain/money.ts",
      "src/lib/notifications/templates/_shared/i18n.ts",
      // Domain/Supabase modules and tests are existing infra — `domain/**`
      // owns enum types and DB row shapes (raw slugs are legitimate there),
      // tests use literal slugs in fixtures, message JSONs aren't code.
      "src/lib/domain/**",
      "src/lib/supabase/**",
      "src/**/__tests__/**",
      "src/messages/**",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...i18nRestrictedSyntax],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local scratch + docs build artifacts — not app source.
    ".tmp/**",
    "Claude Docs/**",
  ]),
]);

export default eslintConfig;
