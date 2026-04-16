import Link from "next/link";
import { SignUpForm, type SignUpRole } from "./form";

const ROLES: readonly SignUpRole[] = ["organizer", "supplier", "agency"];

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const { role: raw } = await searchParams;
  const initialRole: SignUpRole = (ROLES as readonly string[]).includes(raw ?? "")
    ? (raw as SignUpRole)
    : "organizer";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
        ← Back to Sevent
      </Link>
      <h1 className="text-2xl font-semibold">Create your Sevent account</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Choose your role. You can always switch organizer ↔ agency later. Supplier
        onboarding adds documentation steps after sign-up.
      </p>
      <SignUpForm initialRole={initialRole} />
      <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--color-primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
