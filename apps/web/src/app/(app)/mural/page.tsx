import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import { toggleMuralReaction } from "./actions";
import styles from "./mural.module.css";

type MuralPost = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  reactionCount: number;
  createdAt: string;
};

type Birthday = {
  name: string;
  day: number;
  month: number;
};

type MuralPostRecord = {
  id: string;
  glyph: string;
  title: string;
  body: string;
  createdAt: string;
  reactionCount: number;
  reacted: boolean;
};

type BirthdayRecord = {
  name: string;
  day: number;
  month: number;
};

const MONTH_LABEL = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// API DateTime fields arrive as full ISO instant strings (Prisma DateTime ->
// JSON) — timeZone: "UTC" here is not cosmetic: without it, a UTC-midnight
// value shifts to the previous local day (the exact bug the Férias/
// Documentos sub-projects' reviews caught and fixed in their own
// formatDate).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function MuralPage() {
  const session = await getSession();
  if (!session) {
    return <EmptyState title="Sem permissão" description="Faça login para continuar." />;
  }
  if (session.role === "colaborador") {
    return <ColaboradorView />;
  }
  return <TeamView />;
}

async function TeamView() {
  const [posts, birthdays] = await Promise.all([
    apiFetchJson<MuralPost[]>("/mural/posts"),
    apiFetchJson<Birthday[]>("/mural/birthdays"),
  ]);

  if (posts.length === 0 && birthdays.length === 0) {
    return (
      <EmptyState
        title="Mural"
        description="Os comunicados publicados no mural vão aparecer aqui."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mural</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aniversariantes</h2>
        {birthdays.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum aniversariante cadastrado.</p>
        ) : (
          <ul className={styles.birthdayList}>
            {birthdays.map((birthday) => (
              <li key={birthday.name} className={styles.birthdayItem}>
                {birthday.name} · {birthday.day} de {MONTH_LABEL[birthday.month - 1]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comunicados</h2>
        {posts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum comunicado publicado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.glyph}>{post.glyph}</span>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{post.title}</span>
                    <span className={styles.itemDetail}>
                      publicado em {formatDate(post.createdAt)}
                    </span>
                  </div>
                  <span className={styles.reactionCount}>
                    {post.reactionCount} reação(ões)
                  </span>
                </div>
                <p className={styles.body}>{post.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// "Hoje" must follow the company's timezone, not the server's ambient one
// (often UTC in production) — same reasoning as banco-de-horas/page.tsx's
// and ferias/page.tsx's todaySaoPauloDateOnly.
function todaySaoPauloMonthDay(): { day: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") };
}

function birthdaysToday(
  birthdays: BirthdayRecord[],
  today: { day: number; month: number },
): BirthdayRecord[] {
  return birthdays.filter((b) => b.day === today.day && b.month === today.month);
}

function birthdaysThisMonthExcludingToday(
  birthdays: BirthdayRecord[],
  today: { day: number; month: number },
): BirthdayRecord[] {
  return birthdays.filter((b) => b.month === today.month && b.day !== today.day);
}

async function ColaboradorView() {
  const [posts, birthdays] = await Promise.all([
    apiFetchJson<MuralPostRecord[]>("/mural/posts"),
    apiFetchJson<BirthdayRecord[]>("/mural/birthdays"),
  ]);

  if (posts.length === 0 && birthdays.length === 0) {
    return (
      <EmptyState
        title="Mural"
        description="Os comunicados publicados no mural vão aparecer aqui."
      />
    );
  }

  const today = todaySaoPauloMonthDay();
  const todayBirthdays = birthdaysToday(birthdays, today);
  const monthBirthdays = birthdaysThisMonthExcludingToday(birthdays, today);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mural</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Aniversariantes</h2>
        {todayBirthdays.length > 0 ? (
          <div className={styles.birthdayToday}>
            🎂 Aniversariante(s) de hoje: {todayBirthdays.map((b) => b.name).join(", ")}
          </div>
        ) : null}
        {monthBirthdays.length > 0 ? (
          <p className={styles.birthdayMonth}>
            Também fazem aniversário este mês:{" "}
            {monthBirthdays
              .map(
                (b) =>
                  `${b.name} (${String(b.day).padStart(2, "0")}/${String(b.month).padStart(2, "0")})`,
              )
              .join(", ")}
          </p>
        ) : null}
        {todayBirthdays.length === 0 && monthBirthdays.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum aniversariante este mês.</p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comunicados</h2>
        {posts.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum comunicado publicado ainda.</p>
        ) : (
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.glyph}>{post.glyph}</span>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{post.title}</span>
                    <span className={styles.itemDetail}>
                      publicado em {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>
                <p className={styles.body}>{post.body}</p>
                <form action={toggleMuralReaction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    className={
                      post.reacted
                        ? `${styles.reactionButton} ${styles.reactionButtonActive}`
                        : styles.reactionButton
                    }
                  >
                    {post.reacted ? "♥" : "♡"} {post.reactionCount}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
