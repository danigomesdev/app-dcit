import { TimeEntryInputSchema } from "./time-entry";

describe("TimeEntryInputSchema", () => {
  it("accepts a valid payload", () => {
    const result = TimeEntryInputSchema.safeParse({
      userId: "user-123",
      clockedAt: "2026-08-19T13:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing userId", () => {
    const result = TimeEntryInputSchema.safeParse({
      clockedAt: "2026-08-19T13:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with a non-ISO clockedAt", () => {
    const result = TimeEntryInputSchema.safeParse({
      userId: "user-123",
      clockedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
