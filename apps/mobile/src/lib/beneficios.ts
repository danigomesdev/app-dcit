// No benefits-provider backend exists yet — fixed illustrative balances and
// partner discounts, matching spec §4.4.
export type BenefitBalance = {
  id: string;
  icon: "restaurant-outline" | "bus-outline" | "medkit-outline";
  label: string;
  balance: number;
  monthlyCredit: number;
};

export const BENEFIT_BALANCES: BenefitBalance[] = [
  { id: "vr", icon: "restaurant-outline", label: "Vale-refeição", balance: 412.5, monthlyCredit: 600 },
  { id: "vt", icon: "bus-outline", label: "Vale-transporte", balance: 88.0, monthlyCredit: 220 },
  { id: "saude", icon: "medkit-outline", label: "Plano de saúde", balance: 0, monthlyCredit: 0 },
];

export type Partner = {
  id: string;
  name: string;
  category: string;
  discount: string;
};

export const PARTNERS: Partner[] = [
  { id: "1", name: "Smart Fit", category: "Academia", discount: "20% de desconto" },
  { id: "2", name: "Drogaria São Paulo", category: "Farmácia", discount: "15% em genéricos" },
  { id: "3", name: "Alura", category: "Cursos", discount: "30% em qualquer plano" },
  { id: "4", name: "Cinemark", category: "Cinema", discount: "Ingresso com 40% off" },
];

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
