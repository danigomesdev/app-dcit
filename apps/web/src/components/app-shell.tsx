import type { ReactNode } from "react";
import Link from "next/link";

import type { Session } from "@/lib/session";
import { logout } from "@/lib/session";

import styles from "./app-shell.module.css";

const NAV_SECTIONS = [
  { href: "/", label: "Ponto" },
  { href: "/escala", label: "Escala" },
  { href: "/aprovacoes", label: "Aprovações" },
  { href: "/documentos", label: "Documentos" },
] as const;

const ROLE_LABELS: Record<Session["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export function AppShell({ children, user }: { children: ReactNode; user: Session }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.identity}>
          <span className={styles.identityName}>{user.name}</span>
          <span className={styles.identityRole}>{ROLE_LABELS[user.role]}</span>
        </div>
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
        <form action={logout} className={styles.logoutForm}>
          <button type="submit" className={styles.logoutButton}>
            Sair
          </button>
        </form>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
