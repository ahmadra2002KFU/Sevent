"use client";

import Link from "next/link";
import { useEffect } from "react";

// `global-error.tsx` replaces the root layout when it renders, so it MUST
// own its own <html> and <body>. Keep dependencies minimal — anything that
// would normally come from the root layout (providers, fonts, i18n) is
// unavailable here, and pulling them in risks re-triggering the same
// failure that brought us into this boundary.
//
// TODO: localize via next-intl after i18n stability.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fff",
          color: "#0a0a0a",
        }}
      >
        <main
          style={{
            maxWidth: 420,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#525252",
            }}
          >
            A critical error stopped the app from rendering. You can try
            again, or return to the home page.
          </p>
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: "none",
                border: "1px solid #0a0a0a",
                background: "#0a0a0a",
                color: "#fff",
                padding: "0.5rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.5rem 0.875rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                color: "#0a0a0a",
                textDecoration: "none",
                border: "1px solid transparent",
              }}
            >
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
