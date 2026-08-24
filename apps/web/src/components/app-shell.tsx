import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./app-shell.module.css";

const NAV_SECTIONS = [
  { href: "/aprovacoes", label: "Aprovações" },
  { href: "/documentos", label: "Documentos" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.identity}>RH</div>
        <nav>
          <ul className={styles.nav}>
            {NAV_SECTIONS.map((section) => (
              <li key={section.href}>
                <Link href={section.href} className={styles.navLink}>
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
