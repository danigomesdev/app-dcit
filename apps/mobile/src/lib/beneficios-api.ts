import { API_URL } from "@/constants/api";

export type BenefitBalanceRecord = {
  id: string;
  icon: "restaurant-outline" | "bus-outline" | "medkit-outline";
  label: string;
  balance: number;
  monthlyCredit: number;
};

export type PartnerRecord = {
  id: string;
  name: string;
  category: string;
  discount: string;
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

export async function fetchBenefitBalances(token: string): Promise<BenefitBalanceRecord[] | null> {
  try {
    const response = await authedFetch(token, "/beneficios/saldos");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as BenefitBalanceRecord[]) : null;
  } catch {
    return null;
  }
}

export async function fetchPartners(token: string): Promise<PartnerRecord[] | null> {
  try {
    const response = await authedFetch(token, "/beneficios/parceiros");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as PartnerRecord[]) : null;
  } catch {
    return null;
  }
}
