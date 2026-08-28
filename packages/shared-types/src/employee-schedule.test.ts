import { EmployeeScheduleUpdateSchema } from "./employee-schedule";

describe("EmployeeScheduleUpdateSchema", () => {
  it("accepts a valid HH:mm time", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "09:00" });
    expect(result.success).toBe(true);
  });

  it("accepts null (clearing the schedule)", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: null });
    expect(result.success).toBe(true);
  });

  it("rejects a single-digit hour", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "9:00" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range hour", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "24:00" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range minute", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "09:60" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = EmployeeScheduleUpdateSchema.safeParse({ expectedStartTime: "" });
    expect(result.success).toBe(false);
  });
});
