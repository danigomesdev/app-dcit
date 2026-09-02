const mockSetNotificationHandler = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponse = jest.fn();
const mockClearLastNotificationResponse = jest.fn();

jest.mock("expo-notifications", () => ({
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  getLastNotificationResponse: (...args: unknown[]) => mockGetLastNotificationResponse(...args),
  clearLastNotificationResponse: (...args: unknown[]) => mockClearLastNotificationResponse(...args),
}));

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
    mockGetLastNotificationResponse.mockReset().mockReturnValue(null);
    mockClearLastNotificationResponse.mockReset();
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

  it("checks for a cold-start tap via getLastNotificationResponse and clears the sticky value", () => {
    mockGetLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { notificationId: "n2", link: null } } } },
    });
    const onTap = jest.fn();

    addNotificationTapListener(onTap);

    expect(onTap).toHaveBeenCalledWith({ notificationId: "n2", link: null });
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it("does not clear the sticky value when there is no cold-start tap", () => {
    mockGetLastNotificationResponse.mockReturnValue(null);
    const onTap = jest.fn();

    addNotificationTapListener(onTap);

    expect(onTap).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it("returns a cleanup function that removes the listener subscription", () => {
    const remove = jest.fn();
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove });

    const cleanup = addNotificationTapListener(jest.fn());
    cleanup();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
