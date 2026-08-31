"use server";

import type { TimeEntryInput } from "@ponto-dcit/shared-types";

import { apiFetch } from "@/lib/api";

type TimeEntry = { id: string; clockedAt: string };

// userId is required by TimeEntryInputSchema but ignored server-side — the
// API always stamps clockedAt with its own clock and identifies the user
// via the auth token, not this payload (TimeEntriesController.create).
export async function punchTimeEntry(): Promise<TimeEntry> {
  const payload: TimeEntryInput = { userId: "web-user", clockedAt: new Date().toISOString() };
  const res = await apiFetch("/time-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`/time-entries responded with ${res.status}`);
  }
  return (await res.json()) as TimeEntry;
}
