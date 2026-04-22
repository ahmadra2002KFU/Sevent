import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

/**
 * Legacy entry point. The split-hero sign-up now lives under dedicated
 * role-specific routes. Preserve older `?role=…` deep links by forwarding
 * them to the right destination with a 308, so bookmarks and external
 * referrers (the landing CTAs we just repointed are the only in-app ones)
 * continue to work.
 */
export default async function SignUpLegacyRedirect({ searchParams }: PageProps) {
  const { role } = await searchParams;
  if (role === "supplier") {
    permanentRedirect("/sign-up/supplier");
  }
  permanentRedirect("/sign-up/organizer");
}
