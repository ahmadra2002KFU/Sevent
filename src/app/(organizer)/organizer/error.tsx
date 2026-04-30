"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusView } from "@/components/status/StatusView";

// TODO: localize via next-intl after i18n stability.
export default function OrganizerError({
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
    <StatusView
      title="Something went wrong"
      message="We couldn't load this part of your organizer workspace. You can retry or return to your dashboard."
      primary={
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      }
      secondary={{ label: "Back to dashboard", href: "/organizer" }}
    />
  );
}
