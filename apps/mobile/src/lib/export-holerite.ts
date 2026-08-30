import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { formatBRL, netPay, type Payslip } from "@/lib/documentos";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(payslip: Payslip): string {
  const rows = [
    { label: "Salário bruto", value: formatBRL(payslip.gross) },
    { label: "INSS", value: `- ${formatBRL(payslip.inss)}` },
    { label: "IRRF", value: `- ${formatBRL(payslip.irrf)}` },
    { label: "Benefícios", value: `- ${formatBRL(payslip.benefits)}` },
  ];
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 24px; }
          h1 { font-size: 20px; }
          h2 { font-size: 14px; font-weight: normal; color: #666; margin-top: -8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          tfoot td { font-weight: bold; border-bottom: none; border-top: 2px solid #333; }
        </style>
      </head>
      <body>
        <h1>Holerite — Ponto DCIT</h1>
        <h2>${escapeHtml(payslip.label)}</h2>
        <table>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td>Líquido a receber</td>
              <td>${escapeHtml(formatBRL(netPay(payslip)))}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
}

export async function exportHoleritePdf(payslip: Payslip): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(payslip) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  }
}
