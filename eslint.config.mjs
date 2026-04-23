import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// i18n guardrails — block the four classes of locale-blind patterns the sweep
// in `Claude Docs/i18n-locale-aware-rendering-sweep.md` just eradicated. The
// helpers that replace these patterns live in `src/lib/domain/` and accept a
// `locale` argument, so the guardrail ignores that directory plus tests.
const i18nRestrictedSyntax = [
  {
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
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
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
