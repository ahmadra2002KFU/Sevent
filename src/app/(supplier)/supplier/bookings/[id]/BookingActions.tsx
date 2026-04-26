"use client";

/**
 * Supplier booking confirm/decline action panel. Renders inside the
 * "awaiting_supplier" alert on the booking detail page. Two server-action
 * forms with their own `useActionState` so an error on Decline doesn't
 * clobber a Confirm error and vice-versa. Decline opens an AlertDialog with
 * an optional reason field — the action accepts an empty reason.
 */

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmBookingAction, cancelBookingAction } from "./actions";
import {
  initialBookingActionState,
  type BookingActionState,
} from "./action-state";

type Props = { bookingId: string };

export function BookingActions({ bookingId }: Props) {
  const t = useTranslations("booking.actions");
  const [confirmState, confirmFn] = useActionState<
    BookingActionState,
    FormData
  >(confirmBookingAction, initialBookingActionState);
  const [cancelState, cancelFn] = useActionState<BookingActionState, FormData>(
    cancelBookingAction,
    initialBookingActionState,
  );

  // We render error from whichever action last reported one. Success on
  // either path drives the page revalidate, so the success state visibly
  // shifts the whole banner away — no inline success Alert needed.
  const errorMessage =
    confirmState.status === "error"
      ? confirmState.message
      : cancelState.status === "error"
        ? cancelState.message
        : null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={confirmFn}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <ConfirmButton label={t("confirm")} pendingLabel={t("confirming")} />
        </form>
        <DeclineDialog bookingId={bookingId} cancelFn={cancelFn} />
      </div>
      {errorMessage ? (
        <Alert variant="destructive" className="px-3 py-2">
          <AlertTriangle aria-hidden className="size-4" />
          <AlertDescription className="text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ConfirmButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          <Check aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}

function DeclineDialog({
  bookingId,
  cancelFn,
}: {
  bookingId: string;
  cancelFn: (formData: FormData) => void;
}) {
  const t = useTranslations("booking.actions");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" type="button">
          <X aria-hidden />
          {t("decline")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("declineDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("declineDialogBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="decline-reason" className="text-sm">
            {t("reasonLabel")}
          </Label>
          <Textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("reasonPlaceholder")}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form
            action={(fd) => {
              cancelFn(fd);
              setOpen(false);
            }}
          >
            <input type="hidden" name="booking_id" value={bookingId} />
            <input type="hidden" name="reason" value={reason} />
            <DeclineSubmit label={t("declineConfirm")} />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeclineSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction asChild>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <X aria-hidden />
        )}
        {label}
      </Button>
    </AlertDialogAction>
  );
}
