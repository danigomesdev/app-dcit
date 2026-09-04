import { CAREER_LADDER, calcularMediaGeral, NIVEIS_ESCADA } from "./career-ladder";

describe("CAREER_LADDER", () => {
  it("has all 4 níveis with ascending, 4-step degraus", () => {
    for (const nivel of NIVEIS_ESCADA) {
      const info = CAREER_LADDER[nivel];
      expect(info.degraus).toHaveLength(4);
      for (let i = 1; i < info.degraus.length; i++) {
        expect(info.degraus[i]).toBeGreaterThan(info.degraus[i - 1]);
      }
    }
  });

  it("chains proximoNivel correctly, ending in null at especialista", () => {
    expect(CAREER_LADDER.junior.proximoNivel).toBe("pleno");
    expect(CAREER_LADDER.pleno.proximoNivel).toBe("senior");
    expect(CAREER_LADDER.senior.proximoNivel).toBe("especialista");
    expect(CAREER_LADDER.especialista.proximoNivel).toBeNull();
  });

  it("especialista has no eletivo requisitos", () => {
    expect(CAREER_LADDER.especialista.requisitos.some((r) => r.tipo === "eletivo")).toBe(false);
  });

  it("every nível has at least 2 obrigatorio requisitos", () => {
    for (const nivel of NIVEIS_ESCADA) {
      const obrigatorios = CAREER_LADDER[nivel].requisitos.filter((r) => r.tipo === "obrigatorio");
      expect(obrigatorios.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("calcularMediaGeral", () => {
  it("averages a list of scores to one decimal place", () => {
    expect(calcularMediaGeral([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8])).toBe(8);
  });

  it("rounds to one decimal place", () => {
    expect(calcularMediaGeral([7, 8])).toBe(7.5);
    expect(calcularMediaGeral([7, 7, 8])).toBe(7.3);
  });
});
