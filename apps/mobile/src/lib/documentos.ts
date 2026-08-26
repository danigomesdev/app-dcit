export type DocumentStatus = "enviado" | "em_analise" | "aprovado" | "recusado";

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  enviado: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export type Payslip = {
  id: string;
  label: string;
  gross: number;
  inss: number;
  irrf: number;
  benefits: number;
};

export function netPay(payslip: Payslip): number {
  return payslip.gross - payslip.inss - payslip.irrf - payslip.benefits;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
