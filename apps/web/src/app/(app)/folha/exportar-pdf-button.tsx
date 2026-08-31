"use client";

import styles from "./folha.module.css";

export function ExportarPdfButton() {
  return (
    <button type="button" className={styles.exportButton} onClick={() => window.print()}>
      Exportar PDF
    </button>
  );
}
