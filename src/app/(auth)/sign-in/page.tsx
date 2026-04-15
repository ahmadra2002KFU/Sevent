import Link from "next/link";
import { SignInForm } from "./form";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const confirm = params.confirm === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        ← Back to Sevent
      </Link>
      <h1 className="text-2xl font-semibold">Sign in to Sevent</h1>
      {confirm ? (
        <p className="mt-2 rounded-md bg-[var(--color-muted)] p-3 text-sm text-[var(--color-muted-foreground)]">
          We sent a confirmation email. Click the link, then return here to sign
          in.
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Welcome back.
        </p>
      )}
      <SignInForm next={next} />
      <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">
        New here?{" "}
        <Link
          href="/sign-up"
          className="text-[var(--color-primary)] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
