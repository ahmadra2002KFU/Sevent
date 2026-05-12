"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RatingPicker, type DimensionLabels } from "./RatingPicker";

type SubmitReviewState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type Action = (
  prev: SubmitReviewState | undefined,
  formData: FormData,
) => Promise<SubmitReviewState>;

export type ReviewFormProps = {
  bookingId: string;
  action: Action;
  labels: {
    dimensions: DimensionLabels;
    optionalText: string;
    textPlaceholder: string;
    submit: string;
  };
};

/**
 * Client wrapper around the review submission action. Uses `useActionState`
 * so the action's `(prev, formData) => state` signature actually works (a
 * plain `<form action={…}>` would call the action with only `formData`).
 */
export function ReviewForm({ bookingId, action, labels }: ReviewFormProps) {
  const [state, formAction] = useActionState<SubmitReviewState, FormData>(
    action as never,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      <RatingPicker labels={labels.dimensions} />
      <div className="flex flex-col gap-2">
        <label
          htmlFor="review-text"
          className="text-sm font-medium text-foreground"
        >
          {labels.optionalText}
        </label>
        <textarea
          id="review-text"
          name="text"
          rows={5}
          maxLength={2000}
          placeholder={labels.textPlaceholder}
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

      <div className="flex justify-end gap-3">
        <Button type="submit">{labels.submit}</Button>
      </div>
    </form>
  );
}
