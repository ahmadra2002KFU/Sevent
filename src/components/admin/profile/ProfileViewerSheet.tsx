"use client";

import type { ReactNode } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Client wrapper for the parallel `@profile` slot. The slot's matched segment
 * (`useSelectedLayoutSegment("profile")`) drives the Sheet's open state, so
 * navigating to `/admin/messages/profile/<userId>` opens the Sheet and
 * navigating back closes it — all native App Router routing, no manual
 * client-side fetch or JSON contract.
 *
 * Bookmarkable: hitting `/admin/messages/profile/<userId>` directly bypasses
 * the slot (interception only matches soft-nav) and renders the full-page
 * profile route instead. That route exists at
 * `src/app/(admin)/admin/messages/profile/[userId]/page.tsx`.
 */
export function ProfileViewerSheet({
  profile,
  sheetTitle,
}: {
  profile: ReactNode;
  sheetTitle: string;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment("profile");
  // `default.tsx` returns null and produces a `__DEFAULT__` segment. Any other
  // value means the intercepting route matched, so the Sheet should be open.
  const open = segment !== null && segment !== "__DEFAULT__";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) router.back();
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4 pb-6">{profile}</div>
      </SheetContent>
    </Sheet>
  );
}
