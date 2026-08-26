import { PushTokenInputSchema } from "./push-token";

describe("PushTokenInputSchema", () => {
  it("accepts a non-empty token", () => {
    expect(PushTokenInputSchema.safeParse({ token: "ExponentPushToken[abc]" }).success).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(PushTokenInputSchema.safeParse({ token: "" }).success).toBe(false);
  });
});
