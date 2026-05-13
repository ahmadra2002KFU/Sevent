/**
 * Render a curated set of email templates to standalone HTML files so you
 * can open them in a browser and see what they actually look like.
 *
 * Run:  pnpm tsx scripts/render-email-previews.ts
 * Out:  "Claude Docs/email-previews/<name>-<locale>.html" + index.html
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { render } from "@react-email/render";

import { BRAND } from "@/lib/notifications/templates/_brand";
import VerifyEmail from "@/lib/notifications/templates/auth/VerifyEmail";
import SupplierApproved from "@/lib/notifications/templates/supplier/SupplierApproved";
import BookingConfirmed from "@/lib/notifications/templates/organizer/BookingConfirmed";
import BookingCancelledBySupplier from "@/lib/notifications/templates/organizer/BookingCancelledBySupplier";

const OUT_DIR = resolve(process.cwd(), "Claude Docs", "email-previews");
const LOGO_SRC = resolve(process.cwd(), "public", "logo.png");
const LOGO_DEST_RELATIVE = "./logo.png";

const APP_URL = "https://app.seventsa.com";

type PreviewEntry = {
  slug: string;
  locale: "en" | "ar";
  label: string;
  element: React.ReactElement;
};

const PREVIEWS: PreviewEntry[] = [
  // 1. Verify email — EN + AR
  {
    slug: "01a-verify-email-en",
    locale: "en",
    label: "Auth · Verify email — EN",
    element: VerifyEmail({
      locale: "en",
      recipientName: "Ahmad",
      verifyUrl: `${APP_URL}/auth/confirm?token=demo-token`,
      appUrl: APP_URL,
    }),
  },
  {
    slug: "01b-verify-email-ar",
    locale: "ar",
    label: "Auth · Verify email — AR",
    element: VerifyEmail({
      locale: "ar",
      recipientName: "أحمد",
      verifyUrl: `${APP_URL}/auth/confirm?token=demo-token`,
      appUrl: APP_URL,
    }),
  },

  // 2. Supplier approved — EN + AR
  {
    slug: "02a-supplier-approved-en",
    locale: "en",
    label: "Supplier · Approved — EN",
    element: SupplierApproved({
      locale: "en",
      businessName: "Royal Catering Riyadh",
      appUrl: APP_URL,
    }),
  },
  {
    slug: "02b-supplier-approved-ar",
    locale: "ar",
    label: "Supplier · Approved — AR",
    element: SupplierApproved({
      locale: "ar",
      businessName: "استوديو الفن للتصوير",
      appUrl: APP_URL,
    }),
  },

  // 3. Booking confirmed — EN + AR
  {
    slug: "03a-booking-confirmed-en",
    locale: "en",
    label: "Organizer · Booking confirmed — EN",
    element: BookingConfirmed({
      locale: "en",
      organizerName: "Layla",
      supplierBusinessName: "Royal Catering Riyadh",
      eventName: "Aljohani Wedding · Reception",
      eventStartsAtIso: "2026-08-14T19:00:00+03:00",
      bookingUrl: `${APP_URL}/organizer/bookings/demo-id`,
      appUrl: APP_URL,
    }),
  },
  {
    slug: "03b-booking-confirmed-ar",
    locale: "ar",
    label: "Organizer · Booking confirmed — AR",
    element: BookingConfirmed({
      locale: "ar",
      organizerName: "ليلى",
      supplierBusinessName: "ضيافة الرياض الملكية",
      eventName: "زفاف الجوهاني · حفل الاستقبال",
      eventStartsAtIso: "2026-08-14T19:00:00+03:00",
      bookingUrl: `${APP_URL}/organizer/bookings/demo-id`,
      appUrl: APP_URL,
    }),
  },

  // 4. Booking cancelled by supplier — EN + AR
  {
    slug: "04a-booking-cancelled-en",
    locale: "en",
    label: "Organizer · Booking cancelled by supplier — EN",
    element: BookingCancelledBySupplier({
      locale: "en",
      organizerName: "Layla",
      supplierBusinessName: "Royal Catering Riyadh",
      eventName: "Aljohani Wedding · Reception",
      rfqUrl: `${APP_URL}/organizer/rfqs/demo-rfq-id`,
      reason:
        "Sorry — we have a prior booking on the same date and can't fulfil this request.",
      appUrl: APP_URL,
    }),
  },
  {
    slug: "04b-booking-cancelled-ar",
    locale: "ar",
    label: "Organizer · Booking cancelled by supplier — AR",
    element: BookingCancelledBySupplier({
      locale: "ar",
      organizerName: "ليلى",
      supplierBusinessName: "ضيافة الرياض الملكية",
      eventName: "زفاف الجوهاني · حفل الاستقبال",
      rfqUrl: `${APP_URL}/organizer/rfqs/demo-rfq-id`,
      reason: "نعتذر — لدينا حجز سابق في نفس التاريخ ولا يمكننا تلبية الطلب.",
      appUrl: APP_URL,
    }),
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // Copy the actual brand mark next to the previews so the relative path
  // <img src="./logo.png"> resolves when the HTML is opened from disk.
  await copyFile(LOGO_SRC, join(OUT_DIR, "logo.png"));

  // Escape regex meta for safe global replace.
  const prodLogoUrl = BRAND.logoUrl;
  const escaped = prodLogoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const logoUrlRe = new RegExp(escaped, "g");

  const indexRows: string[] = [];

  for (const p of PREVIEWS) {
    const html = (await render(p.element)).replace(logoUrlRe, LOGO_DEST_RELATIVE);
    const filename = `${p.slug}.html`;
    await writeFile(join(OUT_DIR, filename), html, "utf8");
    indexRows.push(
      `<li><a href="./${filename}" target="_blank" rel="noreferrer">${p.label}</a></li>`,
    );
    console.log(`wrote ${filename}`);
  }

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Sevent · Email previews</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           max-width: 720px; margin: 40px auto; padding: 0 16px; color: #0B1E12; }
    h1 { color: #006C35; }
    ul { line-height: 2; padding-left: 20px; }
    a { color: #006C35; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted { color: #637087; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Sevent · Email previews</h1>
  <p class="muted">Generated ${new Date().toISOString()}. Sample data only.</p>
  <ul>${indexRows.join("\n    ")}</ul>
</body>
</html>`;

  await writeFile(join(OUT_DIR, "index.html"), indexHtml, "utf8");
  console.log(`wrote index.html`);
  console.log(`\nOpen: ${join(OUT_DIR, "index.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
