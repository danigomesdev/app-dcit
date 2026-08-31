export type NavRole = "colaborador" | "gestor" | "rh";

export type NavSection = {
  href: string;
  label: string;
  roles: NavRole[];
};

// roles mirrors each page's own session.role guard — kept here so search
// can filter results without duplicating that logic per page.
export const NAV_SECTIONS: NavSection[] = [
  { href: "/", label: "Ponto", roles: ["gestor", "rh"] },
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
