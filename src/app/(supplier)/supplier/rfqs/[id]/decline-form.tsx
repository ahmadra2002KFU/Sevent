"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ReasonCode = "too_busy" | "out_of_area" | "price_mismatch" | "other";

type Labels = {
  trigger: string;
  heading: string;
  body: string;
  reasonLabel: string;
  noteLabel: string;
  cancel: string;
  confirm: string;
  reasons: Record<ReasonCode, string>;
};

type Props = {
  inviteId: string;
  action: (formData: FormData) => void | Promise<void>;
  labels: Labels;
};

/**
 * Decline-invite dialog. Wraps the pre-existing `declineInviteAction` server
 * action in a shadcn Dialog + confirmation UX. The shape of the POST is
 * unchanged: `invite_id`, `decline_reason_code`, `note`.
 */
export function DeclineInviteForm({ inviteId, action, labels }: Props) {
  const [reason, setReason] = useState<ReasonCode>("too_busy");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <XCircle />
          {labels.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.heading}</DialogTitle>
          <DialogDescription>{labels.body}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="invite_id" value={inviteId} />
          <input type="hidden" name="decline_reason_code" value={reason} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="decline-reason">{labels.reasonLabel}</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ReasonCode)}
            >
              <SelectTrigger id="decline-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="too_busy">{labels.reasons.too_busy}</SelectItem>
                <SelectItem value="out_of_area">
                  {labels.reasons.out_of_area}
                </SelectItem>
                <SelectItem value="price_mismatch">
                  {labels.reasons.price_mismatch}
                </SelectItem>
                <SelectItem value="other">{labels.reasons.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="decline-note">{labels.noteLabel}</Label>
            <Textarea
              id="decline-note"
              name="note"
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {labels.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              {labels.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
