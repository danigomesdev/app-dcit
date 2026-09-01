import { EmptyState } from "@/components/empty-state";
import { apiFetchJson } from "@/lib/api";
import { getSession } from "@/lib/session";

import styles from "./beneficios.module.css";

type Balance = {
  id: string;
  userId: string;
  userName: string;
  label: string;
  balance: number;
  monthlyCredit: number;
};

type Partner = {
  id: string;
  name: string;
  category: string;
  discount: string;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupByEmployee(balances: Balance[]): { userId: string; userName: string; balances: Balance[] }[] {
  const groups = new Map<string, { userId: string; userName: string; balances: Balance[] }>();
  for (const balance of balances) {
    const existing = groups.get(balance.userId);
    if (existing) {
      existing.balances.push(balance);
    } else {
      groups.set(balance.userId, { userId: balance.userId, userName: balance.userName, balances: [balance] });
    }
  }
  return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

export default async function BeneficiosPage() {
  const session = await getSession();
  if (!session || session.role === "colaborador") {
    return (
      <EmptyState
        title="Sem permissão"
        description="Esta página é restrita a gestores e RH."
      />
    );
  }

  const [balances, partners] = await Promise.all([
    apiFetchJson<Balance[]>("/beneficios/saldos/equipe"),
    apiFetchJson<Partner[]>("/beneficios/parceiros"),
  ]);

  if (balances.length === 0 && partners.length === 0) {
    return (
      <EmptyState
        title="Benefícios"
        description="Os saldos de benefícios dos colaboradores vão aparecer aqui."
      />
    );
  }

  const employeeGroups = groupByEmployee(balances);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Benefícios</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Saldos por colaborador</h2>
        {employeeGroups.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum saldo cadastrado.</p>
        ) : (
          <div className={styles.employeeList}>
            {employeeGroups.map((group) => (
              <details key={group.userId} className={styles.employeeGroup}>
                <summary className={styles.employeeSummary}>
                  <span className={styles.itemName}>{group.userName}</span>
                  <span className={styles.employeeCount}>
                    {group.balances.length}{" "}
                    {group.balances.length === 1 ? "benefício" : "benefícios"}
                  </span>
                  <svg
                    className={styles.employeeChevron}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <ul className={styles.list}>
                  {group.balances.map((balance) => (
                    <li key={balance.id} className={styles.item}>
                      <span className={styles.itemDetail}>{balance.label}</span>
                      <span className={styles.itemBalance}>
                        {formatCurrency(balance.balance)} · crédito mensal{" "}
                        {formatCurrency(balance.monthlyCredit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Parceiros</h2>
        {partners.length === 0 ? (
          <p className={styles.sectionEmpty}>Nenhum parceiro cadastrado.</p>
        ) : (
          <ul className={styles.list}>
            {partners.map((partner) => (
              <li key={partner.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{partner.name}</span>
                  <span className={styles.itemDetail}>{partner.category}</span>
                </div>
                <span className={styles.itemBalance}>{partner.discount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
