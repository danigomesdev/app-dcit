import { API_URL } from "@/constants/api";

export type SobreavisoStatus = {
  active: boolean;
  startedAt: string | null;
};

export type DeslocamentoRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
};

function isSobreavisoStatus(data: unknown): data is SobreavisoStatus {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.active === "boolean" &&
    (candidate.startedAt === null || typeof candidate.startedAt === "string")
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

export async function fetchSobreavisoStatus(token: string): Promise<SobreavisoStatus | null> {
  try {
    const response = await authedFetch(token, "/operacional/sobreaviso");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isSobreavisoStatus(data) ? data : null;
  } catch {
    return null;
  }
}

export async function toggleSobreaviso(token: string): Promise<SobreavisoStatus | null> {
  try {
    const response = await authedFetch(token, "/operacional/sobreaviso/toggle", {
      method: "POST",
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isSobreavisoStatus(data) ? data : null;
  } catch {
    return null;
  }
}

export async function createDeslocamento(
  token: string,
  startedAt: string,
  endedAt: string,
): Promise<DeslocamentoRecord | null> {
  try {
    const response = await authedFetch(token, "/operacional/deslocamentos", {
      method: "POST",
      body: JSON.stringify({ startedAt, endedAt }),
    });
    if (!response.ok) return null;
    return (await response.json()) as DeslocamentoRecord;
  } catch {
    return null;
  }
}

export async function fetchDeslocamentos(token: string): Promise<DeslocamentoRecord[] | null> {
  try {
    const response = await authedFetch(token, "/operacional/deslocamentos");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as DeslocamentoRecord[]) : null;
  } catch {
    return null;
  }
}
