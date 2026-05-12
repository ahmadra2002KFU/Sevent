/**
 * Server-side wrapper around @react-pdf/renderer.
 *
 * Called from Server Actions; never from the browser bundle. Returns
 * the raw PDF bytes so callers can upload to Supabase Storage without
 * a temp-file round trip.
 */

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ContractDocument, type ContractDocumentInput } from "./ContractDocument";

export async function renderContract(
  input: ContractDocumentInput,
): Promise<Uint8Array> {
  // `renderToBuffer` is typed to accept ReactElement<DocumentProps>, but our
  // ContractDocument is typed by its own props (ContractDocumentInput).
  // It returns a <Document> at runtime — the cast bridges the prop-type gap
  // without changing behaviour.
  const element = createElement(
    ContractDocument,
    input,
  ) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  return new Uint8Array(buffer);
}
