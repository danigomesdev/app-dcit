// No comms/HR backend exists yet — this is fixed illustrative content so
// the feed, birthday highlight, and welcome-card patterns have something
// real to render and interact with.
export type AnnouncementPost = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  createdAt: string;
  reactionCount: number;
};

export const ANNOUNCEMENTS: AnnouncementPost[] = [
  {
    id: "1",
    glyph: "🎉",
    title: "Bem-vindo(a), Marina!",
    body: "A equipe de Suporte ganhou uma nova integrante. Dê as boas-vindas!",
    createdAt: "2026-08-25T09:00:00.000Z",
    reactionCount: 12,
  },
  {
    id: "2",
    glyph: "🎁",
    title: "Nova parceria no clube de vantagens",
    body: "Academia Smart Fit agora com 20% de desconto para colaboradores DCIT. Confira no app.",
    createdAt: "2026-08-20T09:00:00.000Z",
    reactionCount: 8,
  },
  {
    id: "3",
    glyph: "🏆",
    title: "Resultado do trimestre",
    body: "Batemos a meta de satisfação dos clientes em 96%. Parabéns a todos!",
    createdAt: "2026-08-12T09:00:00.000Z",
    reactionCount: 24,
  },
  {
    id: "4",
    glyph: "🛠️",
    title: "Manutenção programada",
    body: "O sistema ficará indisponível no sábado das 2h às 4h para atualização.",
    createdAt: "2026-08-05T09:00:00.000Z",
    reactionCount: 3,
  },
];

// Posts newer than this many days are seeded as "unread" for the demo.
export const UNREAD_WINDOW_DAYS = 3;

export type Birthday = {
  name: string;
  day: number;
  month: number; // 1-12
};

export const BIRTHDAYS: Birthday[] = [
  { name: "Ana Colaboradora", day: 26, month: 8 },
  { name: "Bruno Gestor", day: 30, month: 8 },
  { name: "Carla RH", day: 14, month: 9 },
];

export function birthdaysToday(referenceDate = new Date()): Birthday[] {
  return BIRTHDAYS.filter(
    (b) => b.day === referenceDate.getDate() && b.month === referenceDate.getMonth() + 1,
  );
}

export function birthdaysThisMonthExcludingToday(referenceDate = new Date()): Birthday[] {
  return BIRTHDAYS.filter(
    (b) =>
      b.month === referenceDate.getMonth() + 1 &&
      !(b.day === referenceDate.getDate() && b.month === referenceDate.getMonth() + 1),
  );
}

export function formatRelativeDate(iso: string, referenceDate = new Date()): string {
  const date = new Date(iso);
  const days = Math.floor(
    (referenceDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `Há ${days} dias`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
