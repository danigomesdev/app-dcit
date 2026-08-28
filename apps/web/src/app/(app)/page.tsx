import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { PresencePanel, type TeamMember } from "./presence-panel";

export default async function Home() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const team = await apiFetchJson<TeamMember[]>("/time-entries/team");

  if (team.length === 0) {
    return (
      <EmptyState
        title="Ponto dos funcionários"
        description="A presença dos funcionários no dia vai aparecer aqui."
      />
    );
  }

  return <PresencePanel initialTeam={team} />;
}
