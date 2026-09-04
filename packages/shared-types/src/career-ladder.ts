export const NIVEIS_ESCADA = ["junior", "pleno", "senior", "especialista"] as const;
export type NivelEscada = (typeof NIVEIS_ESCADA)[number];

export const NIVEL_LABELS: Record<NivelEscada, string> = {
  junior: "Analista Júnior",
  pleno: "Analista Pleno",
  senior: "Analista Sênior",
  especialista: "Especialista / Consultor",
};

export type RequisitoLadder = { tipo: "obrigatorio" | "eletivo"; label: string };

export type NivelLadder = {
  nivel: NivelEscada;
  label: string;
  degraus: number[];
  proximoNivel: NivelEscada | null;
  requisitos: RequisitoLadder[];
};

export const CAREER_LADDER: Record<NivelEscada, NivelLadder> = {
  junior: {
    nivel: "junior",
    label: NIVEL_LABELS.junior,
    degraus: [2500, 2900, 3400, 3800],
    proximoNivel: "pleno",
    requisitos: [
      { tipo: "obrigatorio", label: "1 a 2 anos de experiência" },
      { tipo: "obrigatorio", label: "Graduação em andamento ou concluída" },
      { tipo: "eletivo", label: "Certificações não obrigatórias" },
      { tipo: "eletivo", label: "Habilidades em desenvolvimento" },
      { tipo: "eletivo", label: "Atuação sob supervisão" },
    ],
  },
  pleno: {
    nivel: "pleno",
    label: NIVEL_LABELS.pleno,
    degraus: [4000, 4700, 5500, 6200],
    proximoNivel: "senior",
    requisitos: [
      { tipo: "obrigatorio", label: "Mais de 3 anos de experiência" },
      { tipo: "obrigatorio", label: "Graduação completa" },
      { tipo: "eletivo", label: "1 a 2 certificações" },
      { tipo: "eletivo", label: "Autonomia técnica" },
      { tipo: "eletivo", label: "Soft skills em evolução" },
      { tipo: "eletivo", label: "KPIs cumpridos" },
    ],
  },
  senior: {
    nivel: "senior",
    label: NIVEL_LABELS.senior,
    degraus: [6000, 6800, 7700, 8500],
    proximoNivel: "especialista",
    requisitos: [
      { tipo: "obrigatorio", label: "3 anos ou mais como Pleno, com graduação completa" },
      { tipo: "obrigatorio", label: "Especialização desejável e no mínimo 3 certificações" },
      { tipo: "obrigatorio", label: "Soft skills consolidadas e referência técnica" },
      { tipo: "eletivo", label: "Habilidade comercial e insights de upsell" },
      { tipo: "eletivo", label: "Visão de Customer Success" },
      { tipo: "eletivo", label: "KPIs aprimorados" },
      { tipo: "eletivo", label: "Oportunidade de migração do modelo contratual" },
    ],
  },
  especialista: {
    nivel: "especialista",
    label: NIVEL_LABELS.especialista,
    degraus: [8500, 9200, 9800, 10500],
    proximoNivel: null,
    requisitos: [
      { tipo: "obrigatorio", label: "Senioridade comprovada, com formação superior e especialização" },
      { tipo: "obrigatorio", label: "5 ou mais certificações e hard skills avançadas" },
      { tipo: "obrigatorio", label: "Liderança e referência estratégica" },
    ],
  },
};

export const PRINCIPIO_KEYS = ["clareza", "meritocracia", "equilibrio", "transparencia", "desenvolvimento"] as const;
export type PrincipioKey = (typeof PRINCIPIO_KEYS)[number];

export const PRINCIPIOS: Record<PrincipioKey, { label: string; descricao: string }> = {
  clareza: { label: "Clareza", descricao: "Entende sua posição, próximo passo e o que desenvolver." },
  meritocracia: { label: "Meritocracia Responsável", descricao: "Reconhece entregas, evolução e cultura." },
  equilibrio: { label: "Equilíbrio", descricao: "Combina técnica com postura, colaboração e visão de cliente." },
  transparencia: { label: "Transparência", descricao: "Conhece critérios, acompanha resultados e aceita o modelo." },
  desenvolvimento: {
    label: "Desenvolvimento Contínuo",
    descricao: "Busca capacitação, certificações, feedbacks e mentorias.",
  },
};

export const COMPETENCIA_KEYS = [
  "dominio_tecnico",
  "qualidade_solucoes",
  "kpis_tecnicos",
  "comunicacao_postura",
  "organizacao_crises",
  "visao_estrategica",
] as const;
export type CompetenciaKey = (typeof COMPETENCIA_KEYS)[number];

export const COMPETENCIA_CATEGORIA: Record<CompetenciaKey, "hard" | "soft"> = {
  dominio_tecnico: "hard",
  qualidade_solucoes: "hard",
  kpis_tecnicos: "hard",
  comunicacao_postura: "soft",
  organizacao_crises: "soft",
  visao_estrategica: "soft",
};

export const COMPETENCIA_LABELS: Record<CompetenciaKey, string> = {
  dominio_tecnico: "Domínio Técnico & Aplicação Prática",
  qualidade_solucoes: "Qualidade das Soluções & Entregas",
  kpis_tecnicos: "Cumprimento de KPIs Técnicos",
  comunicacao_postura: "Comunicação & Postura com Cliente",
  organizacao_crises: "Organização & Resolução de Crises",
  visao_estrategica: "Visão Estratégica & Trabalho em Equipe",
};

export const ELEGIBILIDADE_MEDIA_MINIMA = 7;

export function calcularMediaGeral(notas: number[]): number {
  const soma = notas.reduce((acc, n) => acc + n, 0);
  return Math.round((soma / notas.length) * 10) / 10;
}
