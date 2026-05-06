"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000;

export type ThreadPollProps = {
  thread_id: string;
  /**
   * The most-recent message timestamp the server-rendered page displayed.
   * Used as the initial `since` watermark; the poll endpoint compares
   * `created_at > since` to find new messages.
   */
  initial_since: string;
};

/**
 * Fires `GET /api/messaging/threads/<id>?since=<iso>` every 10 seconds while
 * the tab is visible. When the response reports `count > 0`, advances the
 * local watermark and triggers `router.refresh()` so the server re-renders
 * the page with the new messages appended.
 *
 * Renders nothing — purely a side-effect component.
 *
 * Suspends polling when:
 *   - `document.visibilityState === "hidden"` (tab in background),
 *   - the component unmounts (cleanup),
 *   - a previous fetch is still in flight (we let the next tick try).
 */
export function ThreadPoll({ thread_id, initial_since }: ThreadPollProps) {
  const router = useRouter();
  const sinceRef = useRef(initial_since);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function tick() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const url = `/api/messaging/threads/${encodeURIComponent(thread_id)}?since=${encodeURIComponent(sinceRef.current)}`;
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { count: number; latest_at: string | null };
        if (json.count > 0 && json.latest_at) {
          sinceRef.current = json.latest_at;
          router.refresh();
        }
      } catch {
        // Aborted or network error — silent; next tick will retry.
      } finally {
        inFlightRef.current = false;
      }
    }

    const id = setInterval(tick, POLL_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // Quick refresh on focus return — picks up anything that arrived
        // while the tab was backgrounded.
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [thread_id, router]);

  return null;
}
