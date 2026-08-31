export type NavRole = "colaborador" | "gestor" | "rh";

export type NavSection = {
  href: string;
  label: string;
  roles: NavRole[];
};

// roles mirrors each page's own session.role guard — kept here so search
// can filter results without duplicating that logic per page.
export const NAV_SECTIONS: NavSection[] = [
  { href: "/", label: "Ponto", roles: ["gestor", "rh", "colaborador"] },
  { href: "/historico", label: "Histórico de Pontos", roles: ["colaborador"] },
  { href: "/folha", label: "Folha de Ponto", roles: ["colaborador"] },
  { href: "/colaboradores", label: "Colaboradores", roles: ["gestor", "rh"] },
  { href: "/escala", label: "Plantão", roles: ["gestor", "rh"] },
  { href: "/aprovacoes", label: "Aprovações", roles: ["gestor", "rh"] },
  { href: "/documentos", label: "Documentos", roles: ["gestor", "rh"] },
  { href: "/mural", label: "Mural", roles: ["gestor", "rh"] },
  { href: "/beneficios", label: "Benefícios", roles: ["gestor", "rh"] },
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh"] },
  { href: "/operacional", label: "Operacional", roles: ["gestor", "rh"] },
  { href: "/alertas", label: "Alertas", roles: ["gestor", "rh"] },
  { href: "/convencoes", label: "Convenções", roles: ["rh"] },
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh"] },
  { href: "/holerites", label: "Holerites", roles: ["gestor", "rh"] },
];

export type SidebarLink = { href: string; label: string };
export type SidebarGroup = { label: string; links: SidebarLink[] };
export type SidebarEntry = SidebarLink | SidebarGroup;

export function isSidebarGroup(entry: SidebarEntry): entry is SidebarGroup {
  return "links" in entry;
}

// The colaborador sidebar is curated and grouped, unlike NAV_SECTIONS above
// (which stays flat — gestor/rh's sidebar, and every role's search results,
// are unaffected by this). Entries here only exist once their page does;
// each is added by its own sub-project as it ships (Ajustar Meu Ponto,
// Solicitações de Ajuste, Banco de Horas, Férias, Documentos, Mural —
// decided in conversation, mirroring the mobile app's tab structure).
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    label: "Ponto",
    links: [
      { href: "/", label: "Bater Ponto" },
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
    ],
  },
];
