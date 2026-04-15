"use client";

import { useActionState } from "react";
import { signUpAction, type AuthState } from "../actions";

const initial: AuthState = { ok: false };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initial);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Full name</span>
        <input
          name="fullName"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Minimum 8 characters with letters and digits.
        </span>
      </label>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">I am …</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="organizer" defaultChecked />
          Organizing an event (corporate, gov, agency, private)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="supplier" />
          An event supplier (venue, catering, photography, decor, more)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="agency" />
          An agency booking on behalf of clients
        </label>
      </fieldset>

      {state?.error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
