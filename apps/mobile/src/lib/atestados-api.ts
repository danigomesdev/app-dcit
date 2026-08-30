import type { AtestadoInput } from "@ponto-dcit/shared-types";

import { API_URL } from "@/constants/api";

export type AtestadoRecord = {
  id: string;
  userId: string;
  userName: string;
  cid: string | null;
  crm: string | null;
  medico: string | null;
  dias: number | null;
  status: string;
  createdAt: string;
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

export async function fetchMyAtestados(token: string): Promise<AtestadoRecord[] | null> {
  try {
    const response = await authedFetch(token, "/atestados/mine");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as AtestadoRecord[]) : null;
  } catch {
    return null;
  }
}

export async function submitAtestado(
  token: string,
  input: AtestadoInput,
): Promise<AtestadoRecord | null> {
  try {
    const response = await authedFetch(token, "/atestados", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as AtestadoRecord;
  } catch {
    return null;
  }
}

export async function fetchTeamAtestados(token: string): Promise<AtestadoRecord[] | null> {
  try {
    const response = await authedFetch(token, "/atestados/team");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as AtestadoRecord[]) : null;
  } catch {
    return null;
  }
}

export async function updateAtestadoStatus(
  token: string,
  id: string,
  status: "aprovado" | "recusado",
): Promise<AtestadoRecord | null> {
  try {
    const response = await authedFetch(token, `/atestados/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return null;
    return (await response.json()) as AtestadoRecord;
  } catch {
    return null;
  }
}
