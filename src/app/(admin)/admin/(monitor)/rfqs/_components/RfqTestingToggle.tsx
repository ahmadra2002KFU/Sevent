"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { setRfqTestingAction } from "../actions";
import { initialActionState } from "../../../verifications/action-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionBanner } from "@/components/admin/profile/ActionBanner";
import { SubmitButton } from "@/components/admin/profile/SubmitButton";

/**
 * Admin control on the RFQ detail page to mark / unmark the RFQ as a testing
 * opportunity. The form posts the *desired* next value so the toggle is a
 * single idempotent submit.
 */
export function RfqTestingToggle({
  rfqId,
  isTesting,
}: {
  rfqId: string;
  isTesting: boolean;
}) {
  const t = useTranslations("admin.rfqs.testing");
  const [state, action] = useActionState(
    setRfqTestingAction,
    initialActionState,
  );

  return (
    <Card
      className={
        isTesting
          ? "border-semantic-warning-500/40 bg-semantic-warning-100/30"
          : undefined
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical aria-hidden className="size-4" />
          {t("heading")}
          {isTesting ? (
            <Badge className="border-semantic-warning-500/40 bg-semantic-warning-100 text-semantic-warning-500">
              {t("badge")}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-4">
        <ActionBanner state={state} />
        <form action={action} className="flex">
          <input type="hidden" name="rfq_id" value={rfqId} />
          {/* Post the inverse of the current state. */}
          <input
            type="hidden"
            name="is_testing"
            value={isTesting ? "false" : "true"}
          />
          <SubmitButton
            variant={isTesting ? "outline" : "default"}
            size="sm"
            pendingLabel={t("working")}
          >
            {isTesting ? t("unmarkCta") : t("markCta")}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
