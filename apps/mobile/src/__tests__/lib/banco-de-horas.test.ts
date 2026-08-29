import {
  endOfMonth,
  formatBRL,
  formatSignedMinutes,
  startOfMonth,
} from "@/lib/banco-de-horas";

describe("formatSignedMinutes", () => {
  it("formats a positive value with a leading +", () => {
    expect(formatSignedMinutes(120)).toBe("+2h 00min");
  });

  it("formats a negative value with a leading -", () => {
    expect(formatSignedMinutes(-90)).toBe("-1h 30min");
  });

  it("formats zero as a positive zero", () => {
    expect(formatSignedMinutes(0)).toBe("+0h 00min");
  });

  it("zero-pads single-digit minute remainders", () => {
    expect(formatSignedMinutes(65)).toBe("+1h 05min");
  });
});

describe("formatBRL", () => {
  it("renders a value as pt-BR currency", () => {
    expect(formatBRL(90.9)).toBe(
      (90.9).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    );
    expect(formatBRL(90.9)).toContain("90,90");
  });
});

describe("startOfMonth", () => {
  it("returns the first day of the current month when monthsAgo is 0", () => {
    const result = startOfMonth(new Date(2026, 7, 20));
    expect(result).toEqual(new Date(2026, 7, 1));
  });

  it("returns the first day of the previous month when monthsAgo is 1", () => {
    const result = startOfMonth(new Date(2026, 7, 20), 1);
    expect(result).toEqual(new Date(2026, 6, 1));
  });
});

describe("endOfMonth", () => {
  it("returns the last day of the current month when monthsAgo is 0", () => {
    const result = endOfMonth(new Date(2026, 7, 20));
    expect(result).toEqual(new Date(2026, 7, 31));
  });

  it("returns the last day of the previous month when monthsAgo is 1", () => {
    const result = endOfMonth(new Date(2026, 7, 20), 1);
    expect(result).toEqual(new Date(2026, 6, 31));
  });
});
