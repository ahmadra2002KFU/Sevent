import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { admin, createOrganizerUser, deleteUserByEmail } from "./helpers/db";

/** Inline sign-in — the shared helper's waitForURL uses an origin-anchored
 *  regex that never matches a full http:// URL. A glob matches the path. */
async function doSignIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(organizer.email);
  await page.getByLabel(/password/i).fill(organizer.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/organizer/**", { timeout: 20_000 });
}

/**
 * Verifies the three organizer/company fixes:
 *   Scope 1 — "Register a company" lives in the account dropdown (only while
 *             the organizer has no company); the dashboard prompt is a slim,
 *             dismissible hint instead of an every-visit two-button card.
 *   Scope 3 — the company onboarding form persists across reload and failed
 *             submit, and clears after a successful create.
 *   Scope 4 — creating a company invite enqueues an email_outbox row and the
 *             panel shows success (the hardened emailQueued path).
 *
 * Test users are minted via the admin auth API (db.ts) — standard test-fixture
 * setup, not real-account access.
 */

const runId = randomUUID().slice(0, 8);
const organizer = {
  email: `e2e-company-${runId}@test.sevent.local`,
  password: "Password123!",
  fullName: "Company Tester",
};
const companyName = `Acme E2E ${runId}`;
const companySlug = `e2e-co-${runId}`;
const billingEmail = `billing-${runId}@test.sevent.local`;
const inviteEmail = `invitee-${runId}@test.sevent.local`;

const SUBMIT = 'form button[type="submit"]';

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await deleteUserByEmail(organizer.email).catch(() => {});
  await createOrganizerUser(organizer);
});

test.afterAll(async () => {
  // Best-effort cleanup (random slug/email, so leftovers are harmless).
  await admin.from("organizer_companies").delete().eq("slug", companySlug);
  await deleteUserByEmail(inviteEmail).catch(() => {});
  await deleteUserByEmail(organizer.email).catch(() => {});
});

// Each Playwright test runs in a fresh (unauthenticated) context, so sign in
// before each. The organizer's DB state (legal_type, company) persists across
// tests and evolves NULL → individual → company as the suite progresses.
test.beforeEach(async ({ page }) => {
  await doSignIn(page);
});

test("company-less organizer: slim hint + dropdown 'Register a company'", async ({
  page,
}) => {
  await page.goto("/organizer/dashboard");

  // Slim hint is shown (legal_type IS NULL).
  await expect(page.getByText(/working with a team/i)).toBeVisible();

  // Dropdown entry present and links to the company form.
  await page.getByRole("button", { name: /account menu/i }).click();
  const registerItem = page.getByRole("menuitem", {
    name: /register a company/i,
  });
  await expect(registerItem).toBeVisible();
  await registerItem.click();
  await expect(page).toHaveURL(/\/organizer\/onboarding\/company$/);
});

test("dismissing the hint persists; dropdown entry stays for individuals", async ({
  page,
}) => {
  await page.goto("/organizer/dashboard");
  await expect(page.getByText(/working with a team/i)).toBeVisible();

  // Click the dismiss (X) button inside the hint — reuses markAsIndividualAction.
  await page
    .getByRole("button", { name: /dismiss/i })
    .click();
  await page.waitForURL(/\/organizer\/dashboard/);

  // Hint gone now and after a reload (server-side legal_type='individual').
  await expect(page.getByText(/working with a team/i)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/working with a team/i)).toHaveCount(0);

  // But an individual with no company still gets the dropdown entry.
  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(
    page.getByRole("menuitem", { name: /register a company/i }),
  ).toBeVisible();
});

test("company form persists across reload + failed submit, clears on success", async ({
  page,
}) => {
  await page.goto("/organizer/onboarding/company");

  await page.locator("#company-name").fill(companyName);
  await page.locator("#company-name-ar").fill("شركة أكمي");
  await page.locator("#company-slug").fill(companySlug);
  await page.locator("#company-billing").fill(billingEmail);

  // (a) Reload restores every field from localStorage.
  await page.reload();
  await expect(page.locator("#company-name")).toHaveValue(companyName);
  await expect(page.locator("#company-slug")).toHaveValue(companySlug);
  await expect(page.locator("#company-billing")).toHaveValue(billingEmail);
  await expect(page.locator("#company-name-ar")).not.toHaveValue("");

  // (b) A failed submit (invalid slug) keeps the values in the form.
  await page.locator("#company-slug").fill("ab"); // too short -> slugInvalid
  await page.locator(SUBMIT).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#company-name")).toHaveValue(companyName);
  await expect(page.locator("#company-billing")).toHaveValue(billingEmail);

  // (c) A successful create redirects to the welcome dashboard.
  await page.locator("#company-slug").fill(companySlug);
  await Promise.all([
    page.waitForURL(/\/organizer\/dashboard\?welcome=1/),
    page.locator(SUBMIT).click(),
  ]);

  // (d) Revisiting the form starts blank — the draft was cleared on submit.
  await page.goto("/organizer/onboarding/company");
  await expect(page.locator("#company-name")).toHaveValue("");
  await expect(page.locator("#company-slug")).toHaveValue("");
});

test("after creating a company, the dropdown entry and hint disappear", async ({
  page,
}) => {
  await page.goto("/organizer/dashboard");
  await expect(page.getByText(/working with a team/i)).toHaveCount(0);

  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(
    page.getByRole("menuitem", { name: /register a company/i }),
  ).toHaveCount(0);
});

test("creating an invite enqueues an email and shows success", async ({
  page,
}) => {
  await page.goto("/organizer/settings/invites");
  await page.locator("#invite-email").fill(inviteEmail);
  await page.locator(SUBMIT).first().click();

  await expect(page.getByText(/invite sent/i)).toBeVisible();

  // The hardened path enqueues an email_outbox row for the invite.
  const { data } = await admin
    .from("email_outbox")
    .select("status, template_kind")
    .eq("recipient_email", inviteEmail)
    .maybeSingle();
  expect(data?.template_kind).toBe("organizer.invite_sent");
});
