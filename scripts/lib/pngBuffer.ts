/**
 * Produces a tiny valid PNG buffer for fixture uploads (1x1 transparent pixel).
 */

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function tinyPngBuffer(): Buffer {
  return Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64");
}

export async function fetchPlaceholderPng(
  url: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`placeholder HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "image/png";
    const ab = await res.arrayBuffer();
    return { bytes: Buffer.from(ab), contentType: ct };
  } catch {
    return { bytes: tinyPngBuffer(), contentType: "image/png" };
  }
}
