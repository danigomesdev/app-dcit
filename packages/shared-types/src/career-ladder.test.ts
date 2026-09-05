import {
  CAREER_LADDER,
  calcularMediaGeral,
  calcularSubNivelIndex,
  NIVEIS_ESCADA,
  subNivelIndexFromSalario,
  subNivelLabel,
  subNivelStatus,
} from "./career-ladder";

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

describe("calcularSubNivelIndex", () => {
  it("returns 0 for média at or below 5.9", () => {
    expect(calcularSubNivelIndex(0)).toBe(0);
    expect(calcularSubNivelIndex(5.9)).toBe(0);
  });

  it("returns 1 for média between 6.0 and 6.9", () => {
    expect(calcularSubNivelIndex(6.0)).toBe(1);
    expect(calcularSubNivelIndex(6.9)).toBe(1);
  });

  it("returns 2 for média between 7.0 and 8.9", () => {
    expect(calcularSubNivelIndex(7.0)).toBe(2);
    expect(calcularSubNivelIndex(8.9)).toBe(2);
  });

  it("returns 3 for média at or above 9.0", () => {
    expect(calcularSubNivelIndex(9.0)).toBe(3);
    expect(calcularSubNivelIndex(10)).toBe(3);
  });
});

describe("subNivelIndexFromSalario", () => {
  it("finds the exact degrau matching the current salary", () => {
    expect(subNivelIndexFromSalario("junior", 2900)).toBe(1);
    expect(subNivelIndexFromSalario("pleno", 6200)).toBe(3);
  });

  it("falls back to the highest degrau at or below an in-between salary", () => {
    expect(subNivelIndexFromSalario("junior", 3000)).toBe(1);
  });

  it("returns 0 for a salary below the first degrau", () => {
    expect(subNivelIndexFromSalario("junior", 0)).toBe(0);
  });
});

describe("subNivelLabel", () => {
  it("composes the short nível name with the 1-based sub-nível number", () => {
    expect(subNivelLabel("junior", 0)).toBe("Júnior 1");
    expect(subNivelLabel("junior", 2)).toBe("Júnior 3");
    expect(subNivelLabel("pleno", 3)).toBe("Pleno 4");
  });
});

describe("subNivelStatus", () => {
  it("reports Em Desenvolvimento for sub-nível 1", () => {
    expect(subNivelStatus("junior", 0)).toBe("Em Desenvolvimento (Nível Inicial: Júnior 1)");
  });

  it("reports Promovido for middle sub-níveis without a transição mention", () => {
    expect(subNivelStatus("junior", 1)).toBe("Promovido para Júnior 2");
    expect(subNivelStatus("junior", 2)).toBe("Promovido para Júnior 3");
  });

  it("mentions transição to the próximo nível at the top sub-nível when one exists", () => {
    expect(subNivelStatus("junior", 3)).toBe("Promovido para Júnior 4 (Elegível para transição para Analista Pleno)");
  });

  it("does not mention a transição at the top sub-nível of especialista (no próximo nível)", () => {
    expect(subNivelStatus("especialista", 3)).toBe("Promovido para Especialista 4");
  });
});
