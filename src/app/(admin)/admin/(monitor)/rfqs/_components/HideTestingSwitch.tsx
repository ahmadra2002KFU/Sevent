"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { setHideTestingOpportunitiesAction } from "../actions";
import { initialActionState } from "../../../verifications/action-state";
import { Card, CardContent } from "@/components/ui/card";
import { ActionBanner } from "@/components/admin/profile/ActionBanner";
import { SubmitButton } from "@/components/admin/profile/SubmitButton";

/**
 * Global kill switch shown atop the admin RFQ list. When ON, every testing
 * opportunity is hidden from the supplier marketplace (list + detail). When
 * OFF, testing opportunities show to suppliers — badged and sorted last.
 *
 * Posts the desired next state so a click is one idempotent submit.
 */
export function HideTestingSwitch({ hidden }: { hidden: boolean }) {
  const t = useTranslations("admin.rfqs.globalHide");
  const [state, action] = useActionState(
    setHideTestingOpportunitiesAction,
    initialActionState,
  );

  return (
    <Card
      className={
        hidden
          ? "border-semantic-warning-500/40 bg-semantic-warning-100/30"
          : undefined
      }
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {hidden ? (
              <EyeOff
                aria-hidden
                className="mt-0.5 size-5 text-semantic-warning-500"
              />
            ) : (
              <Eye aria-hidden className="mt-0.5 size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {t("heading")}
              </span>
              <span className="text-xs text-muted-foreground">
                {hidden ? t("descriptionOn") : t("descriptionOff")}
              </span>
            </div>
          </div>
          <form action={action} className="flex">
            <input
              type="hidden"
              name="hide"
              value={hidden ? "false" : "true"}
            />
            <SubmitButton
              variant={hidden ? "outline" : "destructive"}
              size="sm"
              pendingLabel={t("working")}
            >
              {hidden ? t("disableCta") : t("enableCta")}
            </SubmitButton>
          </form>
        </div>
        <ActionBanner state={state} />
      </CardContent>
    </Card>
  );
}
