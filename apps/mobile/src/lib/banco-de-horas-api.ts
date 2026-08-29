import { API_URL } from "@/constants/api";

export type BancoDeHorasDay = {
  date: string;
  expectedMinutes: number;
  workedMinutes: number;
  diffMinutes: number;
};

export type BancoDeHorasSummary = {
  days: BancoDeHorasDay[];
  balanceMinutes: number;
  dsrMinutes: number;
  hourlyRateBRL: number | null;
  overtimeValueBRL: number | null;
};

function isBancoDeHorasSummary(data: unknown): data is BancoDeHorasSummary {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    Array.isArray(candidate.days) &&
    typeof candidate.balanceMinutes === "number" &&
    typeof candidate.dsrMinutes === "number" &&
    (candidate.hourlyRateBRL === null || typeof candidate.hourlyRateBRL === "number") &&
    (candidate.overtimeValueBRL === null || typeof candidate.overtimeValueBRL === "number")
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

export async function fetchBancoDeHoras(
  token: string,
  start: string,
  end: string,
): Promise<BancoDeHorasSummary | null> {
  try {
    const response = await authedFetch(token, `/banco-de-horas/minhas?start=${start}&end=${end}`);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isBancoDeHorasSummary(data) ? data : null;
  } catch {
    return null;
  }
}
