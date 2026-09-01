import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

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
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
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
