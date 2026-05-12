import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { requireAccess } from "@/lib/auth/access";
import { resolveReviewContext } from "@/lib/domain/reviews.server";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { submitReviewAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierReviewPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("reviews");
  const { user, admin } = await requireAccess("supplier.bookings");

  const ctx = await resolveReviewContext({
    admin,
    bookingId: id,
    viewerProfileId: user.id,
  });

  if (!ctx.ok && ctx.reason === "not_found") notFound();
  if (!ctx.ok && ctx.reason === "not_party") notFound();

  if (ctx.ok && ctx.role !== "supplier") {
    redirect(`/organizer/bookings/${id}/review`);
  }

  const labels = {
    overall: t("dimensions.overall"),
    value: t("dimensions.value"),
    punctuality: t("dimensions.punctuality"),
    professionalism: t("dimensions.professionalism"),
  };

  return (
    <section className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={`/supplier/bookings/${id}`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToBooking")}
        </Link>
      </Button>

      <PageHeader
        title={t("leaveReviewTitle")}
        description={t("leaveReviewDescription")}
      />

      {!ctx.ok ? (
        <Alert>
          <AlertDescription>
            {ctx.reason === "not_completed"
              ? t("blocked.notCompleted")
              : ctx.reason === "missing_completed_at"
                ? t("blocked.notCompleted")
                : ctx.reason === "window_closed"
                  ? t("blocked.windowClosed")
                  : ctx.reason === "already_submitted"
                    ? t("blocked.alreadySubmitted")
                    : ctx.reason === "dispute_open"
                      ? t("blocked.disputeOpen")
                      : t("blocked.generic")}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("formHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm
              bookingId={ctx.booking.id}
              action={submitReviewAction}
              labels={{
                dimensions: labels,
                optionalText: t("optionalText"),
                textPlaceholder: t("textPlaceholder"),
                submit: t("submit"),
              }}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
