/**
 * One-shot deliverability check for the Resend wiring.
 *
 * Sends a plain HTML email via the raw Resend SDK (NOT the app's
 * sendEmail() wrapper) so a failure here points at Resend / DNS, not
 * at our React Email layer.
 *
 *   pnpm tsx scripts/test-resend-send.ts                 # → arabaiah@mufeed.com
 *   pnpm tsx scripts/test-resend-send.ts you@domain.com  # → custom recipient
 *
 * Requires RESEND_API_KEY in .env.local. Reads it without going through
 * src/lib/env.ts so the script works even if other env vars are missing.
 */

import { config } from "dotenv";
import { Resend } from "resend";

config({ path: ".env.local" });

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Sevent <notifications@seventsa.com>";
const to = process.argv[2] ?? "arabaiah@mufeed.com";

if (!apiKey) {
  console.error("RESEND_API_KEY missing from .env.local");
  process.exit(1);
}

const resend = new Resend(apiKey);

async function main() {
  console.log(`from: ${fromEmail}`);
  console.log(`to:   ${to}`);
  console.log("sending…");

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject: "Sevent · Resend deliverability test",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a18;">
        <h2 style="color: #0f2e5c; margin: 0 0 12px;">Resend wiring confirmed</h2>
        <p style="line-height: 1.5; margin: 0 0 12px;">
          If you can read this, Sevent's transactional pipeline is working end-to-end:
          API key valid, apex <code>seventsa.com</code> DKIM signed, DNS reaching inbox.
        </p>
        <p style="color: #6b6b64; font-size: 13px; margin: 24px 0 0;">
          Sent ${new Date().toISOString()} by scripts/test-resend-send.ts
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("\nFAILED");
    console.error(error);
    process.exit(1);
  }

  console.log(`\nOK — Resend id: ${data?.id ?? "(none)"}`);
  console.log("Check the inbox AND spam folder. First send sometimes lands in spam");
  console.log("until the recipient marks it as Not Spam.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
