import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { formatMinutes } from "@/context/ponto-context";

export type FolhaRow = {
  label: string;
  workedMinutes: number;
  isOpen: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(rows: FolhaRow[]): string {
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${formatMinutes(row.workedMinutes)}${row.isOpen ? " (em aberto)" : ""}</td>
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
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <h1>Folha de ponto — Ponto DCIT</h1>
        <table>
          <thead><tr><th>Dia</th><th>Horas trabalhadas</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `;
}

export async function exportFolhaPdf(rows: FolhaRow[]): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(rows) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  }
}
