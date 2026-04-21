import { PublicNav } from "@/components/nav/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";

/**
 * Public surface chrome: top nav + content slot + footer. Applies only to the
 * `(public)` route group — auth, organizer, supplier and admin surfaces each
 * own their own chrome.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
