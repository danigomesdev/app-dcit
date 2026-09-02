const mockAddNotificationResponseReceivedListener = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
}));

import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

globalThis.fetch = jest.fn();

describe("push notification tap navigation", () => {
  beforeEach(async () => {
    (globalThis.fetch as jest.Mock).mockReset();
    mockAddNotificationResponseReceivedListener.mockReset().mockReturnValue({ remove: jest.fn() });
    await saveSessionToken("test-token");
  });

  it("marks the notification read and navigates to its link when a background tap is handled", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "n1",
              type: "pagamento",
              category: "salario",
              message: "Seu salário foi depositado.",
              link: "/historico",
              createdAt: "2026-09-02T21:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (typeof url === "string" && url.includes("/notifications/n1/read") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "n1", link: "/historico" } } } },
    });

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/notifications/n1/read"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to the payload's link when the notification isn't found in the refreshed inbox", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/notifications/mine")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    renderRouter("src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "gone", link: "/historico" } } } },
    });

    await waitFor(() => {
      expect(screen).toHavePathname("/historico");
    });
  });
});
