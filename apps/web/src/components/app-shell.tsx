import type { ReactNode } from "react";
import Image from "next/image";

import type { Session } from "@/lib/session";
import { logout } from "@/lib/session";

import { NavLinks } from "./nav-links";
import { SearchOverlay } from "./search-overlay";
import styles from "./app-shell.module.css";

const ROLE_LABELS: Record<Session["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export function AppShell({ children, user }: { children: ReactNode; user: Session }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Image
            src="/dcit-logo-v2.png"
            alt="DCiT Tecnologia"
            width={1197}
            height={658}
            className={styles.logoImage}
            priority
          />
        </div>
        <NavLinks />
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <SearchOverlay role={user.role} />
          <details className={styles.userMenu}>
            <summary className={styles.userMenuButton} aria-label="Menu do usuário">
              <svg
                className={styles.userIcon}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path
                  d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <div className={styles.userMenuPanel}>
              <div className={styles.userMenuIdentity}>
                <span className={styles.identityName}>{user.name}</span>
                <span className={styles.identityRole}>{ROLE_LABELS[user.role]}</span>
              </div>
              <form action={logout} className={styles.userMenuLogoutForm}>
                <button type="submit" className={styles.userMenuLogout}>
                  Sair
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
