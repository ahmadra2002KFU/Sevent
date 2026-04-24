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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    if (process.platform === "win32") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
