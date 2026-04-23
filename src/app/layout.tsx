import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cn } from "@/lib/utils";
import { ZodLocaleBootstrap } from "./_components/ZodLocaleBootstrap";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "./fonts/Inter-Variable.ttf",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/Inter-Italic-Variable.ttf",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const almarai = localFont({
  src: [
    {
      path: "./fonts/Almarai-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/Almarai-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Almarai-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Almarai-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sevent — Saudi Event Marketplace",
  description:
    "Sevent is the managed marketplace for event organizers and suppliers in Saudi Arabia. Discover, request, compare, and book event services end-to-end.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const localeFontClassName = locale === "ar" ? almarai.className : inter.className;

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        almarai.variable,
      )}
    >
      <body className={cn("min-h-full flex flex-col", localeFontClassName)}>
        <NextIntlClientProvider messages={messages}>
          <ZodLocaleBootstrap />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
