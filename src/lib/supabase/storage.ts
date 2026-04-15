/**
 * Storage helpers — signed URLs + locked upload path convention.
 * Every path is `{supplier_id}/{category}/{filename}`. The server-side callers
 * of these helpers MUST check ownership (or admin role) **before** minting a URL.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKETS = {
  portfolio: "supplier-portfolio",
  docs: "supplier-docs",
  contracts: "contracts",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const SIGNED_URL_SECONDS = {
  preview: 60 * 5, // 5 minutes for admin/doc previews
  download: 60 * 60, // 1 hour for portfolio / contracts
} as const;

export function supplierScopedPath(
  supplierId: string,
  subdir: string,
  filename: string,
): string {
  if (!supplierId || !/^[0-9a-f-]{36}$/i.test(supplierId)) {
    throw new Error(`supplierScopedPath: invalid supplierId: ${supplierId}`);
  }
  if (!subdir || subdir.includes("..") || subdir.startsWith("/")) {
    throw new Error(`supplierScopedPath: invalid subdir: ${subdir}`);
  }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${supplierId}/${subdir}/${Date.now()}-${safeName}`;
}

/** Asserts that a stored path begins with the expected supplier prefix. */
export function assertPathBelongsToSupplier(path: string, supplierId: string): void {
  if (!path.startsWith(`${supplierId}/`)) {
    throw new Error(
      `storage: path ${path} does not belong to supplier ${supplierId}`,
    );
  }
}

export async function createSignedPreviewUrl(
  client: SupabaseClient,
  bucket: StorageBucket,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS.preview);
  if (error || !data) {
    throw new Error(`createSignedPreviewUrl failed: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}

export async function createSignedDownloadUrl(
  client: SupabaseClient,
  bucket: StorageBucket,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS.download);
  if (error || !data) {
    throw new Error(`createSignedDownloadUrl failed: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}

export function publicPortfolioUrl(
  client: SupabaseClient,
  path: string,
): string {
  return client.storage.from(STORAGE_BUCKETS.portfolio).getPublicUrl(path).data.publicUrl;
}
