import { API_URL } from "@/constants/api";

export type JornadaAlertRecord = {
  id: string;
  type: "intrajornada" | "interjornada";
  date: string;
  minutesShort: number;
};

function isJornadaAlertArray(data: unknown): data is JornadaAlertRecord[] {
  return (
    Array.isArray(data) &&
    data.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        (candidate.type === "intrajornada" || candidate.type === "interjornada") &&
        typeof candidate.date === "string" &&
        typeof candidate.minutesShort === "number"
      );
    })
  );
}

async function authedFetch(token: string, path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function fetchJornadaAlerts(token: string): Promise<JornadaAlertRecord[] | null> {
  try {
    const response = await authedFetch(token, "/alertas/minhas");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isJornadaAlertArray(data) ? data : null;
  } catch {
    return null;
  }
}
