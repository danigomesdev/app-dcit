import { greetingForHour } from "@/lib/greeting";

describe("greetingForHour", () => {
  it("returns a morning greeting from 5 to 11", () => {
    expect(greetingForHour(5)).toBe("Bom dia");
    expect(greetingForHour(11)).toBe("Bom dia");
  });

  it("returns an afternoon greeting from 12 to 17", () => {
    expect(greetingForHour(12)).toBe("Boa tarde");
    expect(greetingForHour(17)).toBe("Boa tarde");
  });

  it("returns a night greeting from 18 to 4", () => {
    expect(greetingForHour(18)).toBe("Boa noite");
    expect(greetingForHour(23)).toBe("Boa noite");
    expect(greetingForHour(0)).toBe("Boa noite");
    expect(greetingForHour(4)).toBe("Boa noite");
  });
});
