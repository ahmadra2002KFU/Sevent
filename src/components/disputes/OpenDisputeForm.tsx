"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DISPUTE_REASON_CODES,
  type DisputeReasonCode,
} from "@/lib/domain/disputes";

type OpenState =
  | { status: "idle" }
  | { status: "success"; message: string; disputeId: string }
  | { status: "error"; message: string };

type OpenAction = (
  prev: OpenState | undefined,
  formData: FormData,
) => Promise<OpenState>;

export type OpenDisputeFormProps = {
  bookingId: string;
  action: OpenAction;
  labels: {
    reasonLabel: string;
    reasonPlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    submit: string;
    reasonOptions: Record<DisputeReasonCode, string>;
  };
};

/**
 * Reason picker + description form. The server action accepts FormData;
 * the client passes the reason via a hidden input updated by the Select
 * (shadcn Select doesn't post itself).
 */
export function OpenDisputeForm({
  bookingId,
  action,
  labels,
}: OpenDisputeFormProps) {
  const [state, formAction] = useActionState<OpenState, FormData>(
    action as never,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="booking_id" value={bookingId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="reason_code" className="text-sm font-medium">
          {labels.reasonLabel}
        </label>
        <Select name="reason_code" defaultValue="other">
          <SelectTrigger id="reason_code" className="w-full sm:w-80">
            <SelectValue placeholder={labels.reasonPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {DISPUTE_REASON_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {labels.reasonOptions[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          {labels.descriptionLabel}
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          minLength={20}
          maxLength={2000}
          required
          placeholder={labels.descriptionPlaceholder}
          className="rounded-md border border-input bg-background p-3 text-sm"
        />
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="destructive">
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
