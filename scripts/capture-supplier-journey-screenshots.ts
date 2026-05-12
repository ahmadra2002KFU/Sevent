/**
 * Supplier-journey validation screenshots — captures the end-state UI for
 * every meaningful surface the Chrome MCP run-through hit on 2026-05-12,
 * but persists to disk so they survive the conversation.
 *
 * Run:
 *   pnpm exec tsx scripts/capture-supplier-journey-screenshots.ts
 *
 * Assumes the journey has already been driven (signup → onboarding →
 * approval → RFQ → quote → confirm → contract → completion → review)
 * against the local stack. Specifically expects:
 *   - test accounts (TestPass1234!): test2@test.com (organizer),
 *     supplier-journey@test.local (supplier), admin@sevent.dev (admin)
 *   - booking 0ca19ec6-6703-4c4f-b9c5-f5919a40f1a5
 *   - supplier slug `journey-test-events`
 */

import { chromium, type Page } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASS = "TestPass1234!";
const BOOKING_ID = "0ca19ec6-6703-4c4f-b9c5-f5919a40f1a5";
const SUPPLIER_SLUG = "journey-test-events";
const OUT = path.resolve(
  process.cwd(),
  "Claude Docs/screenshots/2026-05-12-supplier-journey",
);

fs.mkdirSync(OUT, { recursive: true });

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/sign-in`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASS);
  await Promise.all([
    page.waitForURL(/\/(organizer|supplier|admin)\//, { timeout: 15_000 }),
    page
      .locator(
        'button[type="submit"]:has-text("Sign in"), button[type="submit"]:has-text("تسجيل")',
      )
      .click(),
  ]);
}

async function shot(page: Page, name: string) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`saved ${file}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // --- Public surfaces (no auth) -----------------------------------------
  await page.goto(`${BASE_URL}/s/${SUPPLIER_SLUG}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "01-public-supplier-profile");

  // --- Supplier perspective ----------------------------------------------
  await signInAs(page, "supplier-journey@test.local");

  await page.goto(`${BASE_URL}/supplier/dashboard`);
  await page.waitForLoadState("networkidle");
  await shot(page, "02-supplier-dashboard");

  await page.goto(`${BASE_URL}/supplier/profile`);
  await page.waitForLoadState("networkidle");
  await shot(page, "03-supplier-profile-page");

  await page.goto(`${BASE_URL}/supplier/opportunities`);
  await page.waitForLoadState("networkidle");
  await shot(page, "04-supplier-opportunities-list");

  await page.goto(`${BASE_URL}/supplier/rfqs`);
  await page.waitForLoadState("networkidle");
  await shot(page, "05-supplier-rfq-inbox");

  await page.goto(`${BASE_URL}/supplier/bookings`);
  await page.waitForLoadState("networkidle");
  await shot(page, "06-supplier-bookings-list");

  await page.goto(`${BASE_URL}/supplier/bookings/${BOOKING_ID}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "07-supplier-booking-detail-completed");

  await page.goto(`${BASE_URL}/supplier/bookings/${BOOKING_ID}/review`);
  await page.waitForLoadState("networkidle");
  await shot(page, "08-supplier-review-after-submit");

  // --- Organizer perspective ---------------------------------------------
  await signInAs(page, "test2@test.com");

  await page.goto(`${BASE_URL}/organizer/bookings/${BOOKING_ID}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "09-organizer-booking-detail-completed");

  // --- Admin perspective -------------------------------------------------
  await signInAs(page, "admin@sevent.dev");

  await page.goto(`${BASE_URL}/admin/verifications?status=approved`);
  await page.waitForLoadState("networkidle");
  await shot(page, "10-admin-verifications-approved");

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
