import { API_URL } from "@/constants/api";

export type MuralPostRecord = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
};

export type BirthdayRecord = {
  name: string;
  day: number;
  month: number;
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

export async function fetchMuralPosts(token: string): Promise<MuralPostRecord[] | null> {
  try {
    const response = await authedFetch(token, "/mural/posts");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as MuralPostRecord[]) : null;
  } catch {
    return null;
  }
}

export async function toggleMuralReaction(
  token: string,
  postId: string,
): Promise<{ reactionCount: number; reacted: boolean } | null> {
  try {
    const response = await authedFetch(token, `/mural/posts/${postId}/react`, {
      method: "POST",
    });
    if (!response.ok) return null;
    return (await response.json()) as { reactionCount: number; reacted: boolean };
  } catch {
    return null;
  }
}

export async function fetchBirthdays(token: string): Promise<BirthdayRecord[] | null> {
  try {
    const response = await authedFetch(token, "/mural/birthdays");
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as BirthdayRecord[]) : null;
  } catch {
    return null;
  }
}
