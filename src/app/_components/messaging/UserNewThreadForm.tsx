import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui-ext/PageHeader";

import { userNewThreadAction } from "@/app/_actions/messaging";

export type UserNewThreadFormProps = {
  role: "organizer" | "supplier";
};

const CATEGORIES = ["bug", "feature", "confusing", "praise", "other"] as const;

export async function UserNewThreadForm(props: UserNewThreadFormProps) {
  const t = await getTranslations("messaging.newThreadForm");
  const tCommon = await getTranslations("messaging");
  const tCategory = await getTranslations("admin.feedback.filters.category");
  const basePath = `/${props.role}/messages`;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href={basePath}>
            <ArrowLeft className="me-1 size-4" />
            {tCommon("back")}
          </Link>
        </Button>
      </div>

      <PageHeader title={t("title")} />

      <form action={userNewThreadAction} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("category")}</span>
              <span className="text-xs text-muted-foreground">
                {t("categoryHint")}
              </span>
              <select
                name="category"
                className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                defaultValue=""
              >
                <option value="">{t("categoryAll")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCategory(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("subject")}</span>
              <input
                type="text"
                name="subject"
                maxLength={200}
                placeholder={t("subjectPlaceholder")}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("body")}</span>
              <Textarea
                name="body"
                rows={6}
                required
                minLength={1}
                maxLength={10000}
                placeholder={t("bodyPlaceholder")}
                className="resize-y"
              />
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" size="sm">
            {t("submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
