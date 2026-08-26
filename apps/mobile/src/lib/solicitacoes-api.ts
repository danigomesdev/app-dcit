import type {
  AdjustmentRequestInput,
  CompensationRequestInput,
  VacationRequestInput,
} from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export type AdjustmentRequestRecord = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
};

export type CompensationRequestRecord = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
};

export type VacationRequestRecord = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  createdAt: string;
};

export type VacationHistoryRecord = {
  id: string;
  year: number;
  daysTaken: number;
  startDate: string;
  endDate: string;
};

export type FeriasData = {
  requests: VacationRequestRecord[];
  hireDate: string | null;
  history: VacationHistoryRecord[];
};

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

export async function fetchAdjustmentRequests(
  token: string,
): Promise<AdjustmentRequestRecord[] | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/ajustes");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as AdjustmentRequestRecord[]) : null;
  } catch {
    return null;
  }
}

export async function submitAdjustmentRequest(
  token: string,
  input: AdjustmentRequestInput,
): Promise<AdjustmentRequestRecord | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/ajustes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as AdjustmentRequestRecord;
  } catch {
    return null;
  }
}

export async function fetchCompensationRequests(
  token: string,
): Promise<CompensationRequestRecord[] | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/compensacoes");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as CompensationRequestRecord[]) : null;
  } catch {
    return null;
  }
}

export async function submitCompensationRequest(
  token: string,
  input: CompensationRequestInput,
): Promise<CompensationRequestRecord | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/compensacoes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as CompensationRequestRecord;
  } catch {
    return null;
  }
}

function isFeriasData(data: unknown): data is FeriasData {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as FeriasData).requests) &&
    Array.isArray((data as FeriasData).history)
  );
}

export async function fetchFerias(token: string): Promise<FeriasData | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/ferias");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isFeriasData(data) ? data : null;
  } catch {
    return null;
  }
}

export async function submitVacationRequest(
  token: string,
  input: VacationRequestInput,
): Promise<VacationRequestRecord | null> {
  try {
    const response = await authedFetch(token, "/solicitacoes/ferias", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as VacationRequestRecord;
  } catch {
    return null;
  }
}
