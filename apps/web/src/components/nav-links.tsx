"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  COLABORADOR_SIDEBAR,
  isSidebarGroup,
  NAV_SECTIONS,
  type NavRole,
  type SidebarLink,
} from "@/lib/nav-sections";

import styles from "./app-shell.module.css";

function NavLinkItem({ link, pathname }: { link: SidebarLink; pathname: string }) {
  const active = pathname === link.href;
  return (
    <li>
      <Link
        href={link.href}
        className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
        aria-current={active ? "page" : undefined}
      >
        {link.label}
      </Link>
    </li>
  );
}

export function NavLinks({ role }: { role: NavRole }) {
  const pathname = usePathname();

  if (role === "colaborador") {
    return (
      <nav className={styles.navSections}>
        {COLABORADOR_SIDEBAR.map((entry) =>
          isSidebarGroup(entry) ? (
            <div key={entry.label} className={styles.navGroup}>
              <span className={styles.navGroupLabel}>{entry.label}</span>
              <ul className={styles.nav}>
                {entry.links.map((link) => (
                  <NavLinkItem key={link.href} link={link} pathname={pathname} />
                ))}
              </ul>
            </div>
          ) : (
            <ul className={styles.nav} key={entry.href}>
              <NavLinkItem link={entry} pathname={pathname} />
            </ul>
          ),
        )}
      </nav>
    );
  }

  return (
    <nav>
      <ul className={styles.nav}>
        {NAV_SECTIONS.filter((section) => section.roles.includes(role)).map((section) => (
          <NavLinkItem key={section.href} link={section} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}
