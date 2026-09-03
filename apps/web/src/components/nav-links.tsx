"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  COLABORADOR_SIDEBAR,
  GESTOR_CAREER_GROUP,
  isSidebarGroup,
  NAV_SECTIONS,
  type NavRole,
  type SidebarGroup,
  type SidebarLink,
} from "@/lib/nav-sections";

import styles from "./app-shell.module.css";

// A link's href may carry its own query string (the Gestão de Carreiras
// children use `?aba=...`) — usePathname() never includes the query, so a
// plain `pathname === link.href` comparison can never match those. This
// checks the path plus only the query params the link itself specifies,
// ignoring any others present in the current URL (e.g. `userId`) so the
// active state survives picking a colaborador.
function isLinkActive(link: SidebarLink, pathname: string, searchParams: URLSearchParams): boolean {
  const [linkPath, linkQuery] = link.href.split("?");
  if (pathname !== linkPath) return false;
  if (!linkQuery) return true;
  for (const [key, value] of new URLSearchParams(linkQuery)) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function NavLinkItem({
  link,
  pathname,
  searchParams,
}: {
  link: SidebarLink;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const active = isLinkActive(link, pathname, searchParams);
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

function NavGroupItem({
  group,
  pathname,
  searchParams,
}: {
  group: SidebarGroup;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const active = isLinkActive(group, pathname, searchParams);
  // Always starts collapsed ("normal") — expanding is a deliberate click,
  // not something the current route decides for you. Auto-expanding
  // whenever the group's own page was active looked like it never actually
  // collapsed, since "/" (the group's target) is where a colaborador lands
  // right after login.
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.navGroup}>
      <div className={active ? `${styles.navGroupRow} ${styles.navLinkActive}` : styles.navGroupRow}>
        <Link
          href={group.href}
          className={styles.navGroupLink}
          aria-current={active ? "page" : undefined}
        >
          {group.label}
        </Link>
        <button
          type="button"
          className={styles.navGroupToggle}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? `Recolher ${group.label}` : `Expandir ${group.label}`}
        >
          <svg
            className={open ? `${styles.navChevron} ${styles.navChevronOpen}` : styles.navChevron}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open ? (
        <ul className={styles.navChildren}>
          {group.children.map((child) => (
            <NavLinkItem key={child.href} link={child} pathname={pathname} searchParams={searchParams} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function NavLinks({ role }: { role: NavRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (role === "colaborador") {
    return (
      <nav className={styles.navSections}>
        {COLABORADOR_SIDEBAR.map((entry) =>
          isSidebarGroup(entry) ? (
            <NavGroupItem key={entry.href} group={entry} pathname={pathname} searchParams={searchParams} />
          ) : (
            <ul className={styles.nav} key={entry.href}>
              <NavLinkItem link={entry} pathname={pathname} searchParams={searchParams} />
            </ul>
          ),
        )}
      </nav>
    );
  }

  if (role === "gestor") {
    const flatEntries = NAV_SECTIONS.filter((section) => section.roles.includes("gestor"));
    return (
      <nav className={styles.navSections}>
        <ul className={styles.nav}>
          {flatEntries.map((link) => (
            <NavLinkItem key={link.href} link={link} pathname={pathname} searchParams={searchParams} />
          ))}
        </ul>
        <NavGroupItem group={GESTOR_CAREER_GROUP} pathname={pathname} searchParams={searchParams} />
      </nav>
    );
  }

  return (
    <nav>
      <ul className={styles.nav}>
        {NAV_SECTIONS.filter((section) => section.roles.includes(role)).map((section) => (
          <NavLinkItem key={section.href} link={section} pathname={pathname} searchParams={searchParams} />
        ))}
      </ul>
    </nav>
  );
}
