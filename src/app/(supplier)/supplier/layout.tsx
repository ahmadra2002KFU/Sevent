import Link from "next/link";
import { cn } from "@/lib/utils";
import { signOutAction } from "../../(auth)/actions";

const nav = [
  { href: "/supplier/dashboard", label: "Dashboard" },
  { href: "/supplier/onboarding", label: "Onboarding" },
  { href: "/supplier/catalog", label: "Catalog" },
  { href: "/supplier/calendar", label: "Calendar" },
  { href: "/supplier/rfqs", label: "RFQs" },
  { href: "/supplier/bookings", label: "Bookings" },
];

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-7 w-7 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-sevent-green), var(--color-sevent-gold))",
              }}
            />
            <span className="text-base font-semibold tracking-tight">
              Sevent · Supplier
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 hover:bg-[var(--color-muted)]",
                  "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <form action={signOutAction}>
              <button
                type="submit"
                className="ml-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
