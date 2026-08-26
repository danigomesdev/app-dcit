import type { TimeEntryInput } from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "network" | "http" };

/**
 * A thrown/rejected fetch means the request never reached the server (no
 * connectivity, DNS failure, timeout) — that's the case worth queuing for
 * automatic retry. An HTTP error response did reach the server and won't
 * be fixed by retrying the same payload, so it's reported separately.
 */
export async function submitTimeEntry(token: string, clockedAt: string): Promise<SubmitResult> {
  const payload: TimeEntryInput = { userId: "demo-user", clockedAt };
  try {
    const response = await fetch(`${API_URL}/time-entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return response.ok ? { ok: true } : { ok: false, reason: "http" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
