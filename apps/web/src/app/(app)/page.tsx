import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { MeuPontoCard } from "./meu-ponto-card";
import { PresencePanel, type TeamMember } from "./presence-panel";

type TimeEntry = { id: string; clockedAt: string };

// Explicit America/Sao_Paulo, not the server's ambient timezone — same
// reasoning as escala/page.tsx's todaySaoPauloDateOnly (colocated copy,
// not a shared import; see that file's comment for why).
function dateOnlyInSaoPaulo(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function todaySaoPauloDateOnly(): string {
  return dateOnlyInSaoPaulo(new Date());
}

export default async function Home() {
  const session = await getSession();
  if (!session) {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  if (session.role === "colaborador") {
    // The full history, not just today's entries: clock-in/out always
    // alternate over a person's *entire* punch history, not per calendar
    // day, so pairing must happen over the complete list — an overnight
    // shift's clock-in would otherwise be filtered out before it ever gets
    // matched with its clock-out. MeuPontoCard does the pairing and decides
    // per-pair which day (São Paulo) its worked time counts toward.
    const entries = await apiFetchJson<TimeEntry[]>("/time-entries");
    return (
      <MeuPontoCard name={session.name} initialEntries={entries} today={todaySaoPauloDateOnly()} />
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
