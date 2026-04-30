import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusView } from "@/components/status/StatusView";

// TODO: localize via next-intl after i18n stability.
export default function NotFound() {
  return (
    <StatusView
      title="Page not found"
      message="This page doesn't exist or has been moved."
      primary={
        <Button asChild size="sm">
          <Link href="/">Go home</Link>
        </Button>
      }
    />
  );
}
