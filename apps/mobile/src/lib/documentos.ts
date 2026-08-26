// No document/payroll backend exists yet — payslips and admission docs
// below are fixed illustrative examples so the screen has real content to
// browse and expand while that integration is pending.
export type Payslip = {
  id: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

export const PAYSLIPS: Payslip[] = [
  { id: "2026-07", label: "Julho 2026", gross: 6200, inss: 682, irrf: 410, benefits: 380 },
  { id: "2026-06", label: "Junho 2026", gross: 6200, inss: 682, irrf: 410, benefits: 380 },
  { id: "2026-05", label: "Maio 2026", gross: 5950, inss: 654, irrf: 372, benefits: 380 },
  { id: "2026-04", label: "Abril 2026", gross: 5950, inss: 654, irrf: 372, benefits: 380 },
];

export function netPay(payslip: Payslip): number {
  return payslip.gross - payslip.inss - payslip.irrf - payslip.benefits;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type AdmissionDocument = {
  id: string;
  title: string;
  submittedAt: string;
};

export const ADMISSION_DOCUMENTS: AdmissionDocument[] = [
  { id: "adm-1", title: "Contrato de trabalho assinado", submittedAt: "2024-03-15" },
  { id: "adm-2", title: "Documento de identidade (RG/CPF)", submittedAt: "2024-03-15" },
  { id: "adm-3", title: "Comprovante de residência", submittedAt: "2024-03-15" },
  { id: "adm-4", title: "Exame admissional", submittedAt: "2024-03-14" },
];
