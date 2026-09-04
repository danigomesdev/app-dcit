import type { ReactNode } from "react";
import Image from "next/image";

import type { Session } from "@/lib/session";
import { logout } from "@/lib/session";

import { NavLinks } from "./nav-links";
import { NotificationBell } from "./notification-bell";
import { NotificationProvider } from "./notification-context";
import type { NotificationRecord } from "./notification-list";
import { SearchOverlay } from "./search-overlay";
import { ThemeToggle } from "./theme-toggle";
import styles from "./app-shell.module.css";

const ROLE_LABELS: Record<Session["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

export function AppShell({
  children,
  user,
  notifications,
}: {
  children: ReactNode;
  user: Session;
  notifications: NotificationRecord[];
}) {
  return (
    <NotificationProvider notifications={notifications}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <Image
                src="/sgp-icon.png"
                alt="SGP"
                width={1265}
                height={1243}
                className={styles.brandIconImage}
                priority
              />
            </div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>SGP</span>
              <span className={styles.brandSubtitle}>Sistema de Gestão de Pessoas</span>
            </div>
            <svg className={styles.brandChevron} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <NavLinks role={user.role} />
        </aside>
        <div className={styles.main}>
          <header className={styles.topbar}>
            <SearchOverlay role={user.role} />
            <div className={styles.topbarActions}>
              <ThemeToggle />
              <NotificationBell />
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
            </div>
          </header>
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}
