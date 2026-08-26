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

// Stands in for a "meu time" endpoint that doesn't exist yet — enough to
// demo the gestor/RH visibility split the spec requires (§4.1/§4.2): only
// RH ever sees CID/CRM/médico; gestor sees the approval result only.
export type TeamAtestado = {
  id: string;
  colaborador: string;
  status: "enviado" | "em_analise" | "aprovado" | "recusado";
  dias: number;
  cid: string;
  crm: string;
  medico: string;
  createdAt: string;
};

export const TEAM_ATESTADOS: TeamAtestado[] = [
  {
    id: "team-1",
    colaborador: "Ana Colaboradora",
    status: "aprovado",
    dias: 2,
    cid: "J06.9",
    crm: "CRM-MG 45213",
    medico: "Dr. Carlos Mendes",
    createdAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "team-2",
    colaborador: "Marina Suporte",
    status: "em_analise",
    dias: 1,
    cid: "R51",
    crm: "CRM-MG 33012",
    medico: "Dra. Fernanda Costa",
    createdAt: "2026-08-18T09:00:00.000Z",
  },
  {
    id: "team-3",
    colaborador: "Pedro Suporte",
    status: "recusado",
    dias: 3,
    cid: "M54.5",
    crm: "CRM-MG 78120",
    medico: "Dra. Beatriz Lima",
    createdAt: "2026-05-22T09:00:00.000Z",
  },
];

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
