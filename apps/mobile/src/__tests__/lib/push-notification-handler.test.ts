const mockSetNotificationHandler = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
}));

import { waitFor } from "@testing-library/react-native";
import { configureNotificationHandler, addNotificationTapListener } from "@/lib/push";

describe("configureNotificationHandler", () => {
  beforeEach(() => {
    mockSetNotificationHandler.mockReset();
  });

  it("registers a notification handler with expo-notifications", () => {
    configureNotificationHandler();
    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);
  });
});

describe("addNotificationTapListener", () => {
  beforeEach(() => {
    mockAddNotificationResponseReceivedListener.mockReset().mockReturnValue({ remove: jest.fn() });
    mockGetLastNotificationResponseAsync.mockReset().mockResolvedValue(null);
  });

  it("calls onTap with the tapped notification's data", () => {
    const onTap = jest.fn();
    addNotificationTapListener(onTap);

    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as (r: unknown) => void;
    listener({
      notification: { request: { content: { data: { notificationId: "n1", link: "/historico" } } } },
    });

    expect(onTap).toHaveBeenCalledWith({ notificationId: "n1", link: "/historico" });
  });

  it("checks for a cold-start tap via getLastNotificationResponseAsync", async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { notificationId: "n2", link: null } } } },
    });
    const onTap = jest.fn();

    addNotificationTapListener(onTap);

    await waitFor(() => {
      expect(onTap).toHaveBeenCalledWith({ notificationId: "n2", link: null });
    });
  });

  it("returns a cleanup function that removes the listener subscription", () => {
    const remove = jest.fn();
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove });

    const cleanup = addNotificationTapListener(jest.fn());
    cleanup();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
