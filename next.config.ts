import fs from "node:fs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

type UnknownCallback = (...args: unknown[]) => unknown;

function normalizeReadlinkError(error: unknown): unknown {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EISDIR"
  ) {
    const normalized = error as NodeJS.ErrnoException;
    normalized.code = "EINVAL";
    normalized.message = normalized.message.replace(/^EISDIR/, "EINVAL");
    return normalized;
  }
  return error;
}

if (process.platform === "win32") {
  const originalReadlink = fs.readlink.bind(fs) as unknown as (
    ...args: unknown[]
  ) => void;
  const originalReadlinkSync = fs.readlinkSync.bind(fs) as unknown as (
    ...args: unknown[]
  ) => string | Buffer;
  const originalPromisesReadlink = fs.promises.readlink.bind(
    fs.promises,
  ) as unknown as (...args: unknown[]) => Promise<string | Buffer>;

  const patchedReadlink = (...args: unknown[]) => {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === "function") {
      const callback = lastArg as UnknownCallback;
      args[args.length - 1] = (error: unknown, linkString: unknown) =>
        callback(normalizeReadlinkError(error), linkString);
    }
    originalReadlink(...args);
  };

  const patchedReadlinkSync = (...args: unknown[]) => {
    try {
      return originalReadlinkSync(...args);
    } catch (error) {
      throw normalizeReadlinkError(error);
    }
  };

  const patchedPromisesReadlink = async (...args: unknown[]) => {
    try {
      return await originalPromisesReadlink(...args);
    } catch (error) {
      throw normalizeReadlinkError(error);
    }
  };

  Reflect.set(fs, "readlink", patchedReadlink);
  Reflect.set(fs, "readlinkSync", patchedReadlinkSync);
  Reflect.set(fs.promises, "readlink", patchedPromisesReadlink);
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Allow `next/image` to optimize images served from our Supabase Storage host.
 *
 * Derived from `NEXT_PUBLIC_SUPABASE_URL` so the same config works in local
 * dev (`http://127.0.0.1:54321`) and production (`https://api.seventsa.com`)
 * without a hardcoded host list.
 *
 * The pathname is `/storage/v1/object/**` — broad enough to match BOTH public
 * URLs (`/object/public/...`) and short-lived signed URLs (`/object/sign/...`).
 * Supplier logos and portfolio media live in non-public buckets and are served
 * via signed URLs, so restricting to `/object/public/**` (the previous value)
 * silently 400'd every signed image and rendered it as a broken icon.
 */
function supabaseImageRemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        // Empty string when the URL uses the protocol's default port; Next.js
        // treats that as "no port", which is what prod (443) needs.
        port: url.port,
        pathname: "/storage/v1/object/**",
      },
    ];
  } catch {
    // Malformed env — skip rather than crash the build. Images simply won't be
    // optimized until the env is fixed.
    return [];
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The contract PDF is rendered server-side (on supplier booking confirmation)
  // and reads the Almarai TTFs from `src/app/fonts` + the Sevent logo from
  // `public/logo.png` at runtime to embed them (see `src/lib/contracts/fonts.ts`
  // and `assets.ts`). Pin those files into the traced output so they survive a
  // standalone build.
  outputFileTracingIncludes: {
    "/supplier/bookings/[id]": [
      "./src/app/fonts/Almarai-*.ttf",
      "./public/logo.png",
    ],
  },
  experimental: {
    // Server Actions default to a 1 MB FormData cap. Supplier onboarding
    // submits a logo + multiple verification PDFs in one action, and quote
    // builders attach a 10 MB technical-proposal PDF — both blow past 1 MB.
    // Event creation can also carry per-بند attachments (images/documents);
    // ATTACHMENT_MAX_TOTAL_BYTES_PER_SUBMIT (40 MB, see src/lib/domain/attachments.ts)
    // is the attachment budget, so the whole multipart POST needs ~45 MB.
    serverActions: {
      bodySizeLimit: "45mb",
    },
  },
  images: {
    remotePatterns: supabaseImageRemotePatterns(),
  },
  webpack(config) {
    if (process.platform === "win32") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
