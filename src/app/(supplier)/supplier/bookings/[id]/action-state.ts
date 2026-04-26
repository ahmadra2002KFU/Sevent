// Action-state for the supplier booking confirm/decline actions. Held in a
// separate module because Next.js 16 forbids non-async exports from
// "use server" files. Idle/success/error tri-state mirrors the rest of the
// supplier surface; success is conveyed via revalidate (we stay on the same
// page), so the success branch carries a short message.

export type BookingActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const initialBookingActionState: BookingActionState = { status: "idle" };
