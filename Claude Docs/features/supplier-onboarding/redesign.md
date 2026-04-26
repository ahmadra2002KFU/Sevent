# Supplier Onboarding Redesign — Path A (Restrained / product)

**Status:** Planned · not yet executed
**Scope:** Full 7-screen flow redesign, not just sign-up
**Mockup source:** `Claude Docs/mockup-source/direction-a.jsx` + `shared.jsx` (unpacked from the artifact)
**Created:** 2026-04-22
**Previous doc (superseded):** an earlier one-page summary that underestimated scope as "just sign-up"

---

## 1. Correction to the earlier plan

The first analysis pass assumed the mockup redesigned only the sign-up page. **Wrong.** After unpacking the HTML bundle and reading `direction-a.jsx` in full, the mockup is a **7-screen end-to-end supplier journey**, from first account creation to approved first-run dashboard. Earlier plan understated scope by roughly 5×.

The seven screens in `direction-a.jsx:827-835`:

| # | ID | Arabic label | Component |
|---|---|---|---|
| 1 | `a1` | `إنشاء الحساب` | `ASignup` |
| 2 | `a2` | `اختيار المسار` | `APath` |
| 3 | `a3` | `الخطوة ١: معلومات النشاط` | `AStep1` |
| 4 | `a4` | `الخطوة ٢: الفئات` | `AStep2` |
| 5 | `a5` | `الخطوة ٣: التوثيق` | `AStep3` |
| 6 | `a6` | `قيد المراجعة` | `APending` |
| 7 | `a7` | `تم الاعتماد` | `AApproved` |

The README inside the artifact (`shared.jsx:371-415`) calls out 5 product principles we must preserve:
1. **اتجاهان للاختيار** — Two directions (A/B). We chose A.
2. **مساران حسب نوع النشاط** — Two onboarding paths: Freelancer (Nafath only) vs Registered Company (Wathq + automatic verified badge).
3. **معاينة حيّة** — Live profile preview card updates as the supplier types. Rail on the right side of wizard steps.
4. **ذكاء خفيف** — Light smarts: import-from-website, autosave, resume-where-you-left-off.
5. **لحظة احتفال** — Celebration moment on approval: confetti, verified badge, 3 ready RFQs.

---

## 2. Canonical copy deck (authoritative Arabic)

Source: `Claude Docs/mockup-source/shared.jsx:97-190`. Every string below is the approved Arabic wording — do not rewrite.

### Screen 1 — Sign-up (`AR.signup`)
- title: `أنشئ حساب مزود الخدمة`
- sub: `انضم إلى أكبر منصة فعاليات في المملكة. خطوات قليلة وتبدأ في استقبال طلبات العروض.`
- email label: `البريد الإلكتروني للعمل`
- phone label: `رقم الجوال`
- password label: `كلمة المرور`
- password hint: `٨ أحرف على الأقل مع رقم ورمز`  ← **note: stricter than current plan. Requires letters + digit + symbol.**
- cta: `أنشئ الحساب`
- terms: `بالمتابعة، أوافق على الشروط وسياسة الخصوصية`
- already: `لديك حساب بالفعل؟` · signin: `تسجيل الدخول`
- whyTitle: `لماذا سِفنت؟`
- why[0] (trending): `طلبات حقيقية` / `منظمون بميزانيات محددة في كل أنحاء المملكة`
- why[1] (shield): `ضمان الدفع` / `الأموال محفوظة في حساب ضمان حتى انتهاء الفعالية`
- why[2] (badge-check): `توثيق رسمي` / `تحقّق تلقائي من السجل التجاري عبر واثق`
- GEA footnote: `معتمد من الهيئة العامة للترفيه · يعمل في ١٢ مدينة سعودية`

### Screen 2 — Path picker (`AR.path`)
- eyebrow: `قبل أن نبدأ`
- title: `حدّثنا عن نشاطك`
- sub: `نُخصّص رحلة التسجيل بناءً على شكل نشاطك — تستغرق ٨ دقائق في المتوسط.`
- **Freelancer card** — title: `مستقل أو صاحب عمل فردي` · desc: `تعمل باسمك الشخصي أو تحت اسم تجاري بسيط — نحتاج فقط هوية وطنية وشهادة آيبان.` · checklist: `هوية وطنية / شهادة آيبان / نبذة قصيرة` · ETA: `٥ دقائق`
- **Company card** — title: `شركة مسجّلة` · desc: `لديك سجل تجاري نشط — سنتحقق منه تلقائياً ونعرض شارة التوثيق على ملفك.` · checklist: `سجل تجاري / شهادة آيبان / ملف الشركة (اختياري)` · ETA: `٨ دقائق` · gold badge tag: `شارة مزوّد موثّق`
- cta: `متابعة`

### Screens 3–5 — Wizard (`AR.wizard`)
Step labels: `معلومات النشاط` / `الفئات والشرائح` / `التوثيق والهوية البصرية`
- businessName: `الاسم التجاري` · placeholder: `مثال: استوديو أضواء الرياض`
- bio: `نبذة قصيرة` · placeholder: `جملتان أو ثلاث عن تخصصك — ستظهر للمنظمين في ملفك العام` · hint: `اكتبها كما تتحدث لعميل. تجنّب التكرار.`
- crNumber: `رقم السجل التجاري` · hint: `سنتحقق منه فوراً عبر منصة واثق`
- nationalId: `رقم الهوية الوطنية`
- baseCity: `المدينة الأساسية` · placeholder: `اختر مدينتك…`
- serviceArea: `مدن الخدمة` · empty: `أضف المدن التي تستطيع تقديم خدماتك فيها`
- languages: `لغات العمل`
- importUrl card: `لديك موقع إلكتروني؟` / `ألصق الرابط ونعبّئ الحقول تلقائياً` / cta: `استيراد`
- categories: `الفئات الرئيسية` · hint: `اختر ما لا يزيد عن ٦ فئات — الأقل أدق`  ← **cap at 6, not unlimited.**
- segments: `شرائح السوق` · hint: `الشرائح التي تخدمها عادة`
- logoLabel: `الشعار` · hint: `PNG أو SVG، أقل من ١ ميجابايت`
- iban: `شهادة الآيبان` · hint: `PDF رسمي من بنكك — نحتاجها لصرف الأرباح`
- companyProfile: `ملف الشركة (اختياري)` · hint: `PDF حتى ٨ ميجابايت — يُعرض للمنظمين بعد قبول العرض`  ← **shown AFTER quote acceptance, not on public profile.**
- buttons: `رجوع` / `متابعة` / `أرسل للمراجعة` / `حفظ والخروج`
- autosave msg: `تم الحفظ تلقائياً قبل ثوانٍ`

### Screen 6 — Pending review (`AR.pending`)
- status pill: `حالة الطلب · قيد المراجعة`
- title: `استلمنا طلبك`
- sub: `فريق التوثيق يراجع الآن مستنداتك. عادةً ما تستغرق المراجعة ٢٤ ساعة عمل.`
- email notice: `سنرسل إشعاراً على {email} فور اعتماد ملفك`
- checklistTitle: `ما يحدث الآن`
- 5 checks (**this is the new verification state model**):
  1. `wathq` — `التحقق من السجل التجاري` — done — `مُطابق في قاعدة بيانات واثق · الرياض · نشط`
  2. `identity` — `مطابقة الهوية` — done — `تمّت المطابقة عبر نفاذ`
  3. `iban` — `التحقق من الآيبان` — running — `جارٍ التحقق مع البنك — عادةً ٣٠ دقيقة`
  4. `portfolio` — `مراجعة المعرض والخدمات` — waiting — `سيراجعها مختصّ من فريقنا`
  5. `badge` — `إصدار شارة مزوّد موثّق` — waiting — `فور اكتمال الخطوات أعلاه`
- timelineTitle: `ما بعد الاعتماد`
- timeline: `اعتماد الملف / خلال ٢٤ ساعة` → `أول طلب عرض / خلال ٤٨ ساعة في المتوسط` → `أول حجز / حسب جودة عروضك`
- ctas: `عد إلى لوحة التحكم` + `تحدّث مع فريق التوثيق`

### Screen 7 — Approved (`AR.welcome`)
- congrats: `مبروك! ملفك معتمد`
- sub: `شارة "مزوّد موثّق" ظاهرة الآن على ملفك العام. لديك ٣ طلبات عروض تنتظرك.`
- cta1: `اذهب للطلبات` · cta2: `عاين ملفي العام`
- tourTitle: `جولة سريعة (٤٥ ثانية)`

---

## 3. Screen-by-screen implementation spec

### Screen 1 — `/sign-up/supplier` (new dedicated route)

**Layout:** Two-column, form on logical end (right in LTR, left in RTL), navy value panel on the other side. Panel width `520px`, form column `flex:1 · padding:80px 72px · max-width:420px`.

**Panel** (`direction-a.jsx:38-67`):
- Background: `#0f2e5c` navy-900 with radial cobalt glow at 20% 0%
- Sevent logomark in white tone, 26px
- Headline h1, 42px weight 800, line-height 1.2: `انضمّ لأكبر سوق\nفعاليات في المملكة.`
- Sub paragraph, white/72%, max-width 400px
- 3 "why" items (direction-a.jsx:49-62), each: 40px cobalt-tinted rounded icon tile + title + desc
- Bottom footnote, white/50%, 12px: GEA line

**Form side** (`direction-a.jsx:70-113`):
- Eyebrow: cobalt 500, 12.5px bold, letter-spacing 0.5 → `حساب مزوّد خدمة`
- h2 title 30px navy-900 weight 800
- "لديك حساب؟ تسجيل الدخول" link (cobalt)
- 3 fields using the `AField` component (`:118-137`):
  - Work email, validated state (green border + checkmark on right)
  - Phone with `🇸🇦 +966` prefix visible inside field on logical start
  - Password with hint below
- Terms checkbox: 18×18 rounded cobalt-filled with white check, label inline-start
- Primary CTA: cobalt-500, 14px/16px padding, 10px radius, cobalt shadow
- OR divider (neutral-400, 12px)
- Google SSO button: white, 1px neutral-200 border, Google G icon

**Validation rules** (derived from mockup + AR hint text):
- Email: standard + work-email preference (don't block on gmail.com though — it'd be user-hostile for KSA SMBs)
- Phone: Saudi mobile `^5\d{8}$` after +966 strip
- Password: **min 8 chars + letter + digit + symbol** (`٨ أحرف على الأقل مع رقم ورمز` is stricter than earlier plan — update Zod)
- Terms: must be true

### Screen 2 — `/sign-up/supplier/path` (path picker, gate before the wizard)

**New intermediate step.** Appears right after email confirmation + first sign-in if `suppliers.legal_type IS NULL`.

**Layout** (`direction-a.jsx:140-170`):
- Max-width 880px, centered
- ResumeCard at top showing 8% complete, step 1 (if returning)
- Centered hero: eyebrow pill `قبل أن نبدأ` + h1 `حدّثنا عن نشاطك` + sub
- 2-col grid of `APathCard` (`:173-218`):
  - Each card: 52px cobalt icon tile + title (19px weight 800) + desc + divider + "ما ستحتاجه" checklist (dots) + clock icon + ETA
  - Active card: 2px cobalt border, cobalt shadow, checkmark chip top-right
  - Company card: gold "شارة مزوّد موثّق" tag floating top-end (with badge-check icon)
- Bottom: back text button + navy "متابعة" CTA with chevron

**Data model**:
- Freelancer = `legal_type = 'freelancer'` · skip CR field in Step 1, skip Wathq verification block
- Company = `legal_type = 'company'` · Step 1 shows CR field + Wathq alert on success

The column already exists — `suppliers.legal_type` via the 2026-04-21 taxonomy migration. No schema change for this.

### Screen 3 — `/supplier/onboarding` Step 1 (business info)

**Shell** (`direction-a.jsx:220-231`):
- Top bar (`:15-33`): 64px, white, 1px border. Logo on start, step indicator `الخطوة ١ من ٣` in middle-end, vertical divider, language switcher (`<Icon arabic> العربية`), "حفظ والخروج" text button, 34px cobalt-tinted avatar pill.
- Main area: max-width 1180, grid `1fr 340px`, gap 32. Left scrolls, right rail sticky.

**Stepper** (`:233-261`):
- 3 horizontal steps with connecting lines
- Step pill: 28×28 rounded: done → green-500 with white check · active → cobalt-500 with white number · pending → neutral-200 with muted number
- Step label: navy-900 weight 700 when active, neutral-600 weight 500 otherwise
- Connector line: green if done, neutral-200 otherwise
- Numbers are rendered via `ar()` helper (Arabic-Indic: ١ ٢ ٣)

**Step 1 content** (`direction-a.jsx:283-403`):
- Heading + supportive paragraph
- **ImportWebsiteCard**: dashed cobalt border, 36px icon tile, title + sub, URL input + navy "استيراد" button. Already exists as `src/components/supplier/onboarding/ImportWebsiteCard.tsx` — keep.
- Business name field (valid state with green check)
- Bio field: **richer than today's textarea**:
  - Cobalt focused border with 3px outer glow
  - Autosave indicator inside footer row: green check + `تم الحفظ تلقائياً قبل ثوانٍ`
  - Character counter on end: `١٢٧/٢٤٠` (Arabic-Indic digits, cap at 240 chars)
- CR number field (company path only) + Wathq success alert (`:342-349`):
  - Green-100 background, shield icon, inline message like `تحقّق تلقائي من واثق: استوديو أضواء الرياض · نشط · الرياض · منذ ٢٠١٩`, check-circle on end
- Base city: combobox with map-pin icon and chevron-down (already built — `CityCombobox.tsx`)
- Service area cities: chip input (selected chips cobalt-tinted with × remove button, input pill "أضِف مدينة…")
- Languages: pill toggles — `العربية` (cobalt selected) / `English` (cobalt selected) / `اردو` (neutral). Selected state has checkmark inside pill.

**Preview rail** (`direction-a.jsx:263-281`):
- Tiny uppercase label: `معاينة حيّة · كما سيراها المنظّمون`
- `<ProfilePreview>` component — builds the public card live from form state
- Cobalt-tinted tip card with sparkles icon + copy that changes per step:
  - Step 1: `أكمل حقل النبذة لتحفّز ثقة المنظّمين — ملفات مكتملة تحصل على طلبات عروض أكثر بـ٤٠٪.`
  - Step 2: `الفئات الدقيقة تجذب طلبات عروض أعلى جودة. ٣–٤ فئات أفضل من ١٠.`
  - Step 3: `شهادة الآيبان تضمن وصول أرباحك خلال ٢٤ ساعة من انتهاء الفعالية.`

**Bottom nav** (`:405-420`):
- Start: chevron-right + `رجوع` text button (or empty div on first step)
- End: autosave indicator + navy `متابعة` CTA with chevron-left

### Screen 4 — Step 2 (categories + segments)

**Top half — Categories** (`direction-a.jsx:435-480`):
- Label row shows count: `الفئات الرئيسية · ٣ من ٦` (selected/max)
- Enforce **hard cap at 6 selected** (copy explicitly says "اختر ما لا يزيد عن ٦")
- Selected chips row: solid cobalt-500 fill, white text, check + text + × button
- Search input: `ابحث عن فئة…`
- Pill cloud below: every available subcategory as an outline pill with + icon. Selected ones flip to cobalt-filled outline + check icon. Single click to toggle.

**Bottom half — Segments** (`:482-510`):
- Small label + sub hint
- 3-column grid of segment tiles (checkbox square + segment name bold 13.5px). Selected state: cobalt-100 bg + cobalt border + filled cobalt checkbox.
- Data source: `src/lib/domain/segments.ts` → 5 segments. Mockup uses corporate/gov/wedding/private/brand but our canonical is private_occasions/business_events/entertainment_culture/sports_exhibitions/others. **Use canonical.**

### Screen 5 — Step 3 (documents + logo)

**Uploaders** (`direction-a.jsx:552-598`):
- Three `AUploader` instances: Logo, IBAN cert, Company profile (optional).
- **Empty state**: 1.5px dashed neutral-200 border, 44px icon tile (upload icon on neutral-100 bg), cobalt-500 bold "اضغط للرفع" + `أو اسحب الملف هنا`, hint line below.
- **Uploaded state**: green-500 border, green-100 bg, 40px white tile with image/file icon, filename bold, metadata row (size + `مُتحقق` chip if verified), `استبدال` text button on end.
- Optional marker: `(اختياري)` next to label in neutral-400.

**Security reassurance card** (`:536-545`):
- Warn-100 background, shield icon (warn-500), bold + body:
  `مستنداتك بأمان: لن تُعرض للمنظّمين. يطّلع عليها فقط فريق التوثيق الداخلي.`

**Final CTA**: `أرسل للمراجعة` (replaces the normal "متابعة").

### Screen 6 — `/supplier/dashboard` (pending review state)

**This REPLACES the current `PendingReviewChecklist.tsx` component** — structurally similar, but the verification checklist has **5 discrete checks with three states each** (done/running/waiting), where today we only track one overall "under review" state. This implies new backend fields.

**Hero banner** (`direction-a.jsx:604-642`):
- Cobalt-tinted gradient card, 32px padding, start-aligned flex
- 72px rounded shield icon with animated rotating progress ring (2s infinite, 50/214 dasharray)
- Eyebrow `حالة الطلب · قيد المراجعة` cobalt-500
- h1 `استلمنا طلبك` 30px weight 800
- Body + inline email reference
- 2 CTAs: navy `عد إلى لوحة التحكم` + white-outline `تحدّث مع فريق التوثيق` with chat icon

**Grid below** — `1.3fr 1fr`:
- Left: checklist card (5 rows via `ChecklistRow` shared component, `shared.jsx:193-227`). Each row: 32-column grid with state dot (28×28, colored by state: green-500/cobalt-500/neutral-200) + title + desc + end status glyph (`✓` / `…` / `—`).
- Right column stacked: timeline card + navy "keep building" card.
  - Timeline: 3 events along a 1.5px vertical rail. Active first dot is cobalt-filled.
  - Navy card: gradient with cobalt-tinted blur blob top-end, gold sparkle icon, `أكمل ملفك العام لتحصل على طلبات أكثر` + body + `ابدأ بينما تنتظر ←` button.

### Screen 7 — First-run dashboard after approval

**Celebration banner** (`direction-a.jsx:698-735`):
- Gradient: green-500 → cobalt-500 at 105deg, 16px radius, 28px padding
- Confetti rain in absolute-positioned pseudo elements (14 rotated pieces, 3-color rotation: gold / white / cobalt-100)
- 64px badge-check icon in translucent white tile
- Personalized eyebrow `مبروك، نوّاف` + h1 `مبروك! ملفك معتمد`
- Body: `شارة "مزوّد موثّق" ظاهرة الآن على ملفك العام. لديك ٣ طلبات عروض تنتظرك.`
- 2 CTAs in end column: solid white `اذهب للطلبات (٣)` + translucent outline `عاين ملفي العام`

**KPI strip** (`:738-742`): 3 `AKpi` cards — RFQ count (cobalt), profile views 24h (green), response time (gold).

**Main grid** (`:744-806`):
- Left (1.4fr) "طلبات عروض مناسبة لك" feed — 3 mock RFQ rows with org initials tile + org/city/date/budget + match % pill + "أرسل عرضاً ←" inline.
- Right (1fr) quick tour card — 3 onboarding milestones with eye/check icons.

**This is the landing page** that should replace the current "Under review" default on first successful sign-in after approval. After the user dismisses or navigates, the normal `/supplier/dashboard` takes over.

---

## 4. The database changes needed

Today's schema covers most of this but not all. One migration is needed.

### New migration: `supabase/migrations/20260422_supplier_onboarding_redesign.sql`

```sql
-- Legal consent audit trail
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_e164 text;  -- E.164 canonical format ("+9665XXXXXXXX")

-- Verification state machine. Replaces the single boolean "under_review" with
-- per-check granularity so the pending-review screen can render real state.
CREATE TYPE public.verification_check_state AS ENUM ('waiting', 'running', 'done', 'failed');

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS verification_wathq public.verification_check_state NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS verification_wathq_note text,
  ADD COLUMN IF NOT EXISTS verification_identity public.verification_check_state NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS verification_identity_note text,
  ADD COLUMN IF NOT EXISTS verification_iban public.verification_check_state NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS verification_iban_note text,
  ADD COLUMN IF NOT EXISTS verification_portfolio public.verification_check_state NOT NULL DEFAULT 'waiting',
  ADD COLUMN IF NOT EXISTS verification_portfolio_note text,
  ADD COLUMN IF NOT EXISTS verification_badge public.verification_check_state NOT NULL DEFAULT 'waiting';
```

**Existing columns reused** (no change):
- `profiles.phone` — already exists, just add an E.164 canonical variant if we want strict storage
- `suppliers.legal_type` — already has freelancer / company values from the 2026-04-21 migration
- `suppliers.business_name`, `bio`, `base_city`, `service_area_cities[]`, `languages[]`, `logo_path`, `works_with_segments[]`
- Documents via `supplier_documents` table — IBAN cert + company profile already in the enum

**Post-migration backfill**: set `verification_*` columns on existing suppliers to match their current review status (`approved` → all done, `pending_review` → all waiting, etc.).

---

## 5. File-by-file implementation punchlist

### New files
- `supabase/migrations/20260422_supplier_onboarding_redesign.sql` — schema above
- `src/app/(auth)/sign-up/supplier/page.tsx` — new dedicated route (Screen 1)
- `src/app/(auth)/sign-up/supplier/form.tsx` — supplier-specific form (Screen 1 form column)
- `src/components/auth/SupplierSignupHero.tsx` — the navy value panel for Screen 1 (wraps or replaces the generic `SignupValueHero`)
- `src/components/auth/PhoneInput.tsx` — `+966` prefix + Saudi 9-digit mask input
- `src/components/auth/TermsCheckbox.tsx` — cobalt-filled check box + inline linked label
- `src/app/(supplier)/supplier/onboarding/path/page.tsx` — Screen 2 (path picker), gate before the wizard
- `src/app/(supplier)/supplier/onboarding/path/actions.ts` — persists `legal_type` choice
- `src/components/supplier/onboarding/PathCard.tsx` — freelancer/company card
- `src/components/supplier/onboarding/BioField.tsx` — textarea + autosave + char counter + focus ring (extracted because it's its own pattern)
- `src/components/supplier/onboarding/ChecklistRow.tsx` — reusable 3-state verification row (used in pending view)
- `src/components/supplier/onboarding/ResumeCard.tsx` — "continue from where you left off" pill with progress circle
- `src/app/(public)/terms/page.tsx` + `src/app/(public)/privacy/page.tsx` — consent target pages
- `src/messages/en.json` and `ar.json` — 50+ new keys (section 6 below)

### Edited files
- `src/app/(auth)/actions.ts` — add `signUpSupplierSchema`, `signUpSupplierAction`; existing `signUpAction` stays for organizer path
- `src/app/(supplier)/supplier/onboarding/wizard.tsx` — drop the in-wizard `PathPicker` step 0 (now lives at `/supplier/onboarding/path`), wire new Bio field + sharper Wathq success alert + autosave indicator placement
- `src/app/(supplier)/supplier/onboarding/actions.ts` — tighten Zod (max 6 categories, sharper validations)
- `src/app/(supplier)/supplier/dashboard/page.tsx` — render the new pending-review banner + 5-check list + approval timeline; render approved-celebration variant when `verification_badge = 'done'` AND it's the first login after approval (track `suppliers.first_seen_approved_at`)
- `src/components/supplier/onboarding/PendingReviewChecklist.tsx` — rewrite to consume the 5 new `verification_*` columns instead of the single boolean
- `src/components/auth/SignupValueHero.tsx` — keep as generic, pass supplier-specific labels
- `src/app/(public)/page.tsx` — "I supply services" CTA repoint from `/sign-up?role=supplier` to `/sign-up/supplier`
- `src/lib/domain/onboarding.ts` — add `MAX_CATEGORIES = 6` constant, extend Zod if needed
- `src/messages/__tests__/translation-coverage.test.ts` — the new keys will be enforced automatically (guardrail from prior session)

### Files left untouched
- The 12 parent-categories / subcategories taxonomy
- `CategoryPillCloud`, `SegmentsPicker`, `UploadChip`, `ImportWebsiteCard`, `WathqVerifyBanner`, `AutoSaveIndicator`, `CityCombobox`, `HelperText`, `ProfilePreview` — all already exist and match the mockup closely
- Admin verification queue (`/admin/verifications/[id]`) — can be extended in a follow-up to show the 5-check state individually, but not required for this pass
- Public supplier profile `/s/[slug]` — unchanged

---

## 6. Translation key inventory

All of the strings in Section 2 need `auth.signUp.supplier.*`, `supplier.onboarding.path.*`, `supplier.onboarding.wizard.*` (extend existing namespace), `supplier.pending.*` (extend), `supplier.welcome.*` (new) keys. Quick count:

| Namespace | New keys |
|---|---|
| `auth.signUp.supplier.*` | ~15 (eyebrow, title, sub, links, fields, hints, terms, cta, google, value panel copy, GEA footnote) |
| `supplier.onboarding.path.*` | ~12 (hero, both cards, checklists, ETA label, CTA) |
| `supplier.onboarding.wizard.*` | ~8 extensions (bio placeholder + hint, import card copy, segments hint, save-exit label, autosave message) |
| `supplier.pending.*` | ~15 (status pill, title, sub, email-notice, 5 check titles+descs, timelineTitle, 3 timeline items, 2 CTAs, side card) |
| `supplier.welcome.*` | ~10 (congrats, sub, 2 CTAs, tourTitle, 3 tour items, KPI labels) |

Total: **~60 new keys across both locales.** English translations derive from the Arabic source (already in `AR` object in `shared.jsx`). The guardrail test will enforce non-identical values.

---

## 7. Execution order

Verifiable steps. After each step, `pnpm exec tsc --noEmit && pnpm exec eslint src && pnpm test` must pass.

1. **Migration + types** (15 min): new SQL file, regenerate types, backfill existing suppliers.
2. **Translation keys** (30 min): add all 60 new keys to both `en.json` and `ar.json`, using the canonical AR copy from `shared.jsx`. Guardrail stays green.
3. **Terms + Privacy stub pages** (20 min): `/terms` and `/privacy` with placeholder content in both locales. Use placeholder text → flag for legal review in PR description.
4. **Landing CTA repoint** (5 min): `src/app/(public)/page.tsx`.
5. **Screen 1** — dedicated supplier sign-up (60 min): route + form + `PhoneInput` + `TermsCheckbox` + `SupplierSignupHero` + `signUpSupplierAction` + Zod schema.
6. **Screen 2** — path picker (45 min): new route + `PathCard` × 2 + `ResumeCard` + action to persist `legal_type`.
7. **Screens 3–5** — wizard tweaks (60 min): extract `BioField`, wire 6-cap on categories, move `PathPicker` step 0 out of the wizard (supplier already has `legal_type` by the time they land here), move autosave indicator inside the bottom nav.
8. **Screen 6** — pending view (60 min): rewrite `PendingReviewChecklist.tsx` to consume the 5 new columns. The visual structure is almost entirely there already from prior work; this is mostly data wiring.
9. **Screen 7** — approved celebration (45 min): new component `ApprovedHero` + confetti block + KPI trio + "matching RFQs" feed + tour card. Gate behind `first_seen_approved_at IS NULL` check; once viewed, stamp the timestamp.
10. **Manual AR + EN walkthrough** (45 min): click through all 7 screens, confirm copy, confirm autosave, confirm phone validation, confirm terms gate, confirm the celebration shows once.
11. **Pre-commit gate**: tsc + eslint + test + translation-coverage guardrail.

**Total: ~7 hours of code + 1 hour QA.** Pad for content revisions.

---

## 8. Open decisions (same 4 as before, restated precisely)

1. **T&C + Privacy content.** Recommendation: ship stub pages with "نسخة تجريبية — قيد المراجعة القانونية" marker. Block v1.0 public launch on legal sign-off, but don't block building.
2. **Google OAuth production-ready?** The `startGoogleOAuthAction` in `src/app/(auth)/actions.ts:124-141` is wired but untested in prod. Need to verify Google provider is enabled in Supabase Dashboard → Authentication → Providers. If not: feature-flag the button behind `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`.
3. **Full-name capture.** Mockup drops it from sign-up. Recommendation: add it to Step 1 of the wizard as "اسم المسؤول" (representative name) — separate from `business_name`. Single text field, required.
4. **Legacy `/sign-up` route.** Recommendation: keep it but remove the supplier card; generic `/sign-up` becomes organizer-centric. Add a discreet "مزوّد خدمة؟" link below the form pointing at `/sign-up/supplier`.

---

## 9. What I need from you before code starts

Give me a yes/no on the 4 decisions above. Once confirmed, I can execute steps 1–11 in one session (~8 working hours). The canonical AR copy is locked, the design is locked, the schema is locked.

If you want to revise any Arabic copy from Section 2 (e.g., change `استلمنا طلبك` to something else), say so **before** step 2, because that's the step that bakes the strings into `messages/ar.json`.

---

## 10. Reference files

Committed for future reference — do not delete:
- `Claude Docs/mockup-source/direction-a.jsx` — the chosen direction, 837 lines, 7 screens
- `Claude Docs/mockup-source/direction-b.jsx` — rejected direction, kept for historical reference only
- `Claude Docs/mockup-source/shared.jsx` — palette, icons, canonical AR copy deck, `ProfilePreview`, `ChecklistRow`, `ResumeCard`
- `Claude Docs/mockup-source/_design-canvas.jsx` — the Figma-style wrapper used by the artifact; not shipped

Original HTML bundle: `C:\Users\Ahmad\Downloads\Sevent Supplier Onboarding.html` (1.7MB, self-extracting artifact).
