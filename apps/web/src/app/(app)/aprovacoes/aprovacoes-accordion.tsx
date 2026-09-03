"use client";

import { useState, type ReactNode } from "react";

import styles from "./aprovacoes.module.css";

type AccordionItem = { key: string; label: string; content: ReactNode };
type AccordionGroup = { key: string; label: string; items: AccordionItem[] };

// A single openKey shared across both groups (Fila / Histórico) — clicking
// any category header expands only that one and collapses whatever was
// open before, in either group. Nothing is open by default, so the page
// starts as just the 2 group headings + 4 collapsed category rows each,
// instead of every category's full list rendered at once.
export function AprovacoesAccordion({ groups }: { groups: AccordionGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className={styles.group}>
          <h1 className={styles.heading}>{group.label}</h1>
          <div className={styles.categories}>
            {group.items.map((item) => {
              const fullKey = `${group.key}:${item.key}`;
              const isOpen = openKey === fullKey;
              return (
                <div key={fullKey} className={styles.categoryGroup}>
                  <button
                    type="button"
                    className={isOpen ? `${styles.categoryHeader} ${styles.categoryHeaderActive}` : styles.categoryHeader}
                    onClick={() => setOpenKey(isOpen ? null : fullKey)}
                    aria-expanded={isOpen}
                    aria-label={`${item.label} — ${group.label}`}
                  >
                    <span className={styles.categoryLabel}>{item.label}</span>
                    <svg
                      className={isOpen ? `${styles.categoryChevron} ${styles.categoryChevronOpen}` : styles.categoryChevron}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isOpen ? <div className={styles.categoryBody}>{item.content}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
