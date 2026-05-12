/**
 * Slice 4B validation screenshots — captures the key UI states the
 * Chrome MCP run-through hit, but persists them to disk so they survive
 * the conversation.
 *
 * Run:
 *   pnpm exec tsx scripts/capture-slice-4b-screenshots.ts
 *
 * Assumes:
 *   - Local stack running, app on http://localhost:3000
 *   - Test accounts exist with password "TestPass1234!":
 *       test2@test.com  (organizer)
 *       test@test.com   (supplier)
 *       admin@sevent.dev
 *   - The completed booking ff491305-23bf-4b4e-832b-4695632c5ebd exists.
 */

import { chromium, type Page } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASS = "TestPass1234!";
const BOOKING_ID = "ff491305-23bf-4b4e-832b-4695632c5ebd";
const DISPUTE_ID = "fc3b0749-3b32-4624-8386-606bd512e348";
const OUT = path.resolve(
  process.cwd(),
  "Claude Docs/screenshots/2026-05-12-slice-4b-validation",
);

fs.mkdirSync(OUT, { recursive: true });

async function signInAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/sign-in`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASS);
  await Promise.all([
    page.waitForURL(/\/(organizer|supplier|admin)\//, { timeout: 15_000 }),
    page.locator('button[type="submit"]:has-text("Sign in"), button[type="submit"]:has-text("تسجيل الدخول")').click(),
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

  // 1. Organizer — booking detail showing both CTAs (review + dispute).
  await signInAs(page, "test2@test.com");
  await page.goto(`${BASE_URL}/organizer/bookings/${BOOKING_ID}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "01-organizer-booking-detail");

  // 2. Organizer — dispute page (existing thread + evidence).
  await page.goto(`${BASE_URL}/organizer/bookings/${BOOKING_ID}/dispute`);
  await page.waitForLoadState("networkidle");
  await shot(page, "02-organizer-dispute-thread");

  // 3. Organizer — review page (post-submit "already submitted" state).
  await page.goto(`${BASE_URL}/organizer/bookings/${BOOKING_ID}/review`);
  await page.waitForLoadState("networkidle");
  await shot(page, "03-organizer-review-after-submit");

  // 4. Supplier — same dispute thread from the other party's perspective.
  await signInAs(page, "test@test.com");
  await page.goto(`${BASE_URL}/supplier/bookings/${BOOKING_ID}/dispute`);
  await page.waitForLoadState("networkidle");
  await shot(page, "04-supplier-dispute-thread");

  // 5. Admin — monitor list with new Disputes tab.
  await signInAs(page, "admin@sevent.dev");
  await page.goto(`${BASE_URL}/admin/disputes`);
  await page.waitForLoadState("networkidle");
  await shot(page, "05-admin-disputes-list");

  // 6. Admin — dispute detail (resolved state with resolution_jsonb).
  await page.goto(`${BASE_URL}/admin/disputes/${DISPUTE_ID}`);
  await page.waitForLoadState("networkidle");
  await shot(page, "06-admin-dispute-detail-resolved");

  await browser.close();
  console.log(`\nDone. Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
