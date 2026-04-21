"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import {
  approveSupplierAction,
  rejectSupplierAction,
} from "../actions";
import { initialActionState } from "../action-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierVerificationStatus } from "@/lib/supabase/types";
import { ActionBanner } from "./ActionBanner";
import { SubmitButton } from "./SubmitButton";

export function SupplierActions({
  supplierId,
  defaultNotes,
  currentStatus,
}: {
  supplierId: string;
  defaultNotes?: string | null;
  currentStatus?: SupplierVerificationStatus;
}) {
  const t = useTranslations("admin.verifications");
  const [approveState, approve] = useActionState(
    approveSupplierAction,
    initialActionState,
  );
  const [rejectState, reject] = useActionState(
    rejectSupplierAction,
    initialActionState,
  );
  const [showReject, setShowReject] = useState(false);
  const notesId = useId();

  const alreadyApproved = currentStatus === "approved";
  const alreadyRejected = currentStatus === "rejected";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("decisionHeading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-4">
        <ActionBanner state={approveState} />
        <ActionBanner state={rejectState} />

        <div className="flex flex-wrap items-center gap-2">
          {/* Approve confirmation uses shadcn Dialog as a stand-in for
              AlertDialog (which is not yet part of the shared primitive set).
              The server-action form is rendered inside the dialog so the
              submit button triggers the real action. */}
          {!alreadyApproved ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="default" size="sm">
                  <Check aria-hidden />
                  {t("approve")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("confirm.approveTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("confirm.approveBody")}
                  </DialogDescription>
                </DialogHeader>
                <form action={approve} className="contents">
                  <input type="hidden" name="supplier_id" value={supplierId} />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        {t("confirm.cancel")}
                      </Button>
                    </DialogClose>
                    <SubmitButton
                      variant="default"
                      pendingLabel={t("approve") + "…"}
                    >
                      {t("confirm.approveConfirm")}
                    </SubmitButton>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}

          {!alreadyRejected ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowReject((v) => !v)}
              aria-expanded={showReject}
            >
              <X aria-hidden />
              {showReject ? t("confirm.cancel") : t("reject")}
            </Button>
          ) : null}
        </div>

        {showReject ? (
          <form
            action={reject}
            className="flex flex-col gap-2 border-t border-border pt-3"
          >
            <input type="hidden" name="supplier_id" value={supplierId} />
            <Label htmlFor={notesId} className="text-xs">
              {t("notesLabel")}
            </Label>
            <Textarea
              id={notesId}
              name="notes"
              required
              minLength={1}
              maxLength={2000}
              rows={4}
              defaultValue={defaultNotes ?? ""}
              placeholder={t("notesPlaceholder")}
            />
            <div className="flex justify-end">
              <SubmitButton
                variant="destructive"
                size="sm"
                pendingLabel={t("reject") + "…"}
              >
                {t("reject")}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
