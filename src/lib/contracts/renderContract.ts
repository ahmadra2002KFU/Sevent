/**
 * Server-side wrapper around @react-pdf/renderer.
 *
 * Called from Server Actions; never from the browser bundle. Returns
 * the raw PDF bytes so callers can upload to Supabase Storage without
 * a temp-file round trip.
 */

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  ContractDocument,
  type ContractDocumentInput,
  type ContractLocale,
} from "./ContractDocument";
import { registerContractFonts } from "./fonts";

/**
 * Render ONE monolingual contract (English or Arabic). The two languages are
 * separate files — callers invoke this once per locale.
 */
export async function renderContract(
  input: ContractDocumentInput,
  locale: ContractLocale,
): Promise<Uint8Array> {
  // Register the Almarai (Arabic + Latin) family before rendering. Idempotent.
  registerContractFonts();
  // `renderToBuffer` is typed to accept ReactElement<DocumentProps>, but our
  // ContractDocument is typed by its own props. It returns a <Document> at
  // runtime — the cast bridges the prop-type gap without changing behaviour.
  const element = createElement(ContractDocument, {
    ...input,
    locale,
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  return new Uint8Array(buffer);
}
