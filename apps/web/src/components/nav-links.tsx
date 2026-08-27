"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./app-shell.module.css";

const NAV_SECTIONS = [
  { href: "/", label: "Ponto" },
  { href: "/escala", label: "Escala" },
  { href: "/aprovacoes", label: "Aprovações" },
  { href: "/documentos", label: "Documentos" },
  { href: "/mural", label: "Mural" },
  { href: "/beneficios", label: "Benefícios" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/operacional", label: "Operacional" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className={styles.nav}>
        {NAV_SECTIONS.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                aria-current={active ? "page" : undefined}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
