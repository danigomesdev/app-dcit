import styles from "./aprovacoes.module.css";

type ApprovalItem = {
  id: string;
  name: string;
  detail: string;
};

export function ApprovalSection({
  title,
  emptyLabel,
  items,
  onDecide,
}: {
  title: string;
  emptyLabel: string;
  items: ApprovalItem[];
  onDecide: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {items.length === 0 ? (
        <p className={styles.sectionEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemDetail}>{item.detail}</span>
              </div>
              <div className={styles.itemActions}>
                <form action={onDecide}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="aprovado" />
                  <button type="submit" className={styles.approveButton}>
                    Aprovar
                  </button>
                </form>
                <form action={onDecide}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="recusado" />
                  <button type="submit" className={styles.rejectButton}>
                    Recusar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
