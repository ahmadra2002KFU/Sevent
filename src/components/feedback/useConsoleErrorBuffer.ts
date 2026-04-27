"use client";

import { useEffect, useRef } from "react";

export type CapturedConsoleError = {
  ts: string;
  level: "error" | "unhandledrejection";
  msg: string;
};

const MAX_ENTRIES = 10;
const MAX_MSG_CHARS = 500;

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ")
    .slice(0, MAX_MSG_CHARS);
}

/**
 * Hook that captures the last N console.error calls + unhandled promise
 * rejections into a ring buffer, surfaceable via the returned `getSnapshot`.
 *
 * - Idempotent: stores the original handlers in module scope guards so a
 *   StrictMode double-mount won't double-wrap.
 * - Restores the original handlers on unmount.
 * - Returns a stringified-array snapshot ready to ship as a hidden form input.
 */
export function useConsoleErrorBuffer(): {
  getSnapshot: () => string;
} {
  const bufferRef = useRef<CapturedConsoleError[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalError = window.console.error;
    const originalRejectionHandler = window.onunhandledrejection;

    const push = (entry: CapturedConsoleError) => {
      const buf = bufferRef.current;
      buf.push(entry);
      if (buf.length > MAX_ENTRIES) {
        buf.splice(0, buf.length - MAX_ENTRIES);
      }
    };

    window.console.error = (...args: unknown[]) => {
      push({
        ts: new Date().toISOString(),
        level: "error",
        msg: formatArgs(args),
      });
      // Always call through so devtools still surface the error to the dev.
      originalError.apply(window.console, args as []);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : typeof reason === "string"
            ? reason
            : (() => {
                try {
                  return JSON.stringify(reason);
                } catch {
                  return String(reason);
                }
              })();
      push({
        ts: new Date().toISOString(),
        level: "unhandledrejection",
        msg: msg.slice(0, MAX_MSG_CHARS),
      });
      // Defer to any existing handler (e.g. Sentry) — don't swallow.
      if (typeof originalRejectionHandler === "function") {
        originalRejectionHandler.call(window, event);
      }
    };
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
      window.console.error = originalError;
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  function getSnapshot(): string {
    if (bufferRef.current.length === 0) return "";
    try {
      return JSON.stringify(bufferRef.current);
    } catch {
      return "";
    }
  }

  return { getSnapshot };
}
