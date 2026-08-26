import * as FileSystem from "expo-file-system/legacy";
import type { AtestadoOcrResult } from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export type OcrOutcome = { ok: true; result: AtestadoOcrResult } | { ok: false };

function mediaTypeFor(uri: string): "image/jpeg" | "image/png" {
  return uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

/**
 * Never throws — a failed OCR call falls back to manual entry, the same
 * "courtesy assist, never blocks the flow" pattern used elsewhere in the
 * atestado submission form.
 */
export async function extractAtestadoData(token: string, photoUri: string): Promise<OcrOutcome> {
  try {
    const imageBase64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const response = await fetch(`${API_URL}/atestados/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64, mediaType: mediaTypeFor(photoUri) }),
    });
    if (!response.ok) return { ok: false };
    const result = (await response.json()) as AtestadoOcrResult;
    return { ok: true, result };
  } catch {
    return { ok: false };
  }
}
