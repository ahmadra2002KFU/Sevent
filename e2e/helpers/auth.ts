import { type Page, expect } from "@playwright/test";

/**
 * Drive the sign-in form. Email confirmations are disabled locally so a
 * fresh user (created via admin.auth.admin.createUser in db.ts) can sign
 * in immediately.
 */
export async function signIn(
  page: Page,
  opts: { email: string; password: string; expectPath?: string },
): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(opts.email);
  await page.getByLabel(/password/i).fill(opts.password);
  await Promise.all([
    page.waitForURL(/^\/(organizer|supplier|admin)\//, { timeout: 15_000 }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  if (opts.expectPath) {
    await expect(page).toHaveURL(new RegExp(opts.expectPath));
  }
}

export async function signOut(page: Page): Promise<void> {
  await page.goto("/");
  // Try the user menu first; fall back to a hard cookie clear.
  const menuTrigger = page.getByRole("button", { name: /account|menu|user/i });
  if (await menuTrigger.isVisible().catch(() => false)) {
    await menuTrigger.click();
    const signOutItem = page.getByRole("menuitem", { name: /sign out|log out/i });
    if (await signOutItem.isVisible().catch(() => false)) {
      await signOutItem.click();
      return;
    }
  }
  // Hard reset.
  await page.context().clearCookies();
  await page.goto("/");
}
