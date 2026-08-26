// No scheduling backend exists yet — fixed illustrative on-call roster for
// the current week (spec §4.5).
export type PlantaoShift = {
  day: string;
  person: string;
};

export const PLANTAO_SEMANA: PlantaoShift[] = [
  { day: "Segunda", person: "Bruno Gestor" },
  { day: "Terça", person: "Ana Colaboradora" },
  { day: "Quarta", person: "Ana Colaboradora" },
  { day: "Quinta", person: "Carla RH" },
  { day: "Sexta", person: "Bruno Gestor" },
  { day: "Sábado", person: "Ana Colaboradora" },
  { day: "Domingo", person: "Carla RH" },
];

export function formatElapsed(startedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}min`;
}
