import { API_URL } from "@/constants/api";

export async function registerPushToken(sessionToken: string, pushToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch {
    // Best-effort registration — a failed call just means no push for this
    // device until the next login, never something the login flow depends on.
  }
}

export async function unregisterPushToken(sessionToken: string, pushToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/push-tokens`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch {
    // Best-effort — worst case the token stays registered to this user
    // until the next login on this device reassigns it via upsert.
  }
}
