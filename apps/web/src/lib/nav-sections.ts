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
  { href: "/documentos", label: "Documentos", roles: ["gestor", "rh", "colaborador"] },
  { href: "/mural", label: "Mural", roles: ["gestor", "rh", "colaborador"] },
  { href: "/beneficios", label: "Benefícios", roles: ["gestor", "rh"] },
  { href: "/pagamentos", label: "Pagamentos", roles: ["rh"] },
  { href: "/onboarding", label: "Onboarding", roles: ["gestor", "rh"] },
  { href: "/operacional", label: "Operacional", roles: ["gestor", "rh"] },
  { href: "/alertas", label: "Alertas", roles: ["gestor", "rh"] },
  { href: "/convencoes", label: "Convenções", roles: ["rh"] },
  { href: "/banco-de-horas", label: "Banco de Horas", roles: ["gestor", "rh", "colaborador"] },
  { href: "/ferias", label: "Férias", roles: ["colaborador"] },
  { href: "/holerites", label: "Holerites", roles: ["gestor", "rh"] },
  { href: "/notificacoes", label: "Notificações", roles: ["colaborador", "gestor", "rh"] },
];

export type SidebarLink = { href: string; label: string };
// A group's own row is itself a link (label + href) — clicking it navigates,
// like any other item. Its chevron independently expands/collapses
// `children`, which only ever show while expanded.
export type SidebarGroup = { href: string; label: string; children: SidebarLink[] };
export type SidebarEntry = SidebarLink | SidebarGroup;

export function isSidebarGroup(entry: SidebarEntry): entry is SidebarGroup {
  return "children" in entry;
}

// The colaborador sidebar is curated and grouped, unlike NAV_SECTIONS above
// (which stays flat — gestor/rh's sidebar, and every role's search results,
// are unaffected by this). Entries here only exist once their page does;
// each is added by its own sub-project as it ships (Ajustar Meu Ponto,
// Solicitações de Ajuste land inside the "Ponto" group; Banco de Horas,
// Férias, Documentos, Mural join as their own top-level entries —
// decided in conversation, mirroring the mobile app's tab structure).
export const COLABORADOR_SIDEBAR: SidebarEntry[] = [
  {
    href: "/",
    label: "Ponto",
    children: [
      { href: "/historico", label: "Histórico de Pontos" },
      { href: "/folha", label: "Folha de Ponto" },
    ],
  },
  { href: "/banco-de-horas", label: "Banco de Horas" },
  { href: "/ferias", label: "Férias" },
  { href: "/documentos", label: "Documentos" },
  { href: "/mural", label: "Mural" },
];

// Gestor-only — deliberately not shared with rh (see the Gestão de Carreiras
// design spec: the original request was explicit that this is manager-only,
// unlike most other gestor+rh shared team screens in this app).
export const GESTOR_CAREER_GROUP: SidebarGroup = {
  href: "/gestao-carreiras",
  label: "Gestão de Carreiras",
  children: [
    { href: "/gestao-carreiras?aba=pdi", label: "PDI & Metas" },
    { href: "/gestao-carreiras?aba=trilha", label: "Matriz de Promoção / Trilhas de Carreira" },
    { href: "/gestao-carreiras?aba=avaliacoes", label: "Avaliações de Desempenho" },
  ],
};
