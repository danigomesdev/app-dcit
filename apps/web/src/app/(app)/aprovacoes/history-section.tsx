import styles from "./aprovacoes.module.css";

type HistoryItem = {
  id: string;
  name: string;
  detail: string;
  status: "aprovado" | "recusado";
  reviewNote?: string | null;
};

export function HistorySection({
  title,
  emptyLabel,
  items,
}: {
  title?: string;
  emptyLabel: string;
  items: HistoryItem[];
}) {
  return (
    <section className={styles.section}>
      {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
      {items.length === 0 ? (
        <p className={styles.sectionEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
                {item.status === "recusado" && item.reviewNote && (
                  <span className={styles.itemNote}>Motivo: {item.reviewNote}</span>
                )}
              </div>
              <span
                className={
                  item.status === "aprovado" ? styles.statusApproved : styles.statusRejected
                }
              >
                {item.status === "aprovado" ? "Aprovado" : "Recusado"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
