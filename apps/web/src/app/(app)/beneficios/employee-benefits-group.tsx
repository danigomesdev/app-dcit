"use client";

import { useState } from "react";

import styles from "./beneficios.module.css";

type Balance = {
  id: string;
  label: string;
  balance: number;
  monthlyCredit: number;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function EmployeeBenefitsGroup({
  userName,
  balances,
}: {
  userName: string;
  balances: Balance[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.employeeGroup}>
      <button
        type="button"
        className={styles.employeeRow}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.itemName}>{userName}</span>
        <span className={styles.employeeCount}>
          {balances.length} {balances.length === 1 ? "benefício" : "benefícios"}
        </span>
        <svg
          className={open ? `${styles.employeeChevron} ${styles.employeeChevronOpen}` : styles.employeeChevron}
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
      </button>
      {open ? (
        <ul className={styles.list}>
          {balances.map((balance) => (
            <li key={balance.id} className={styles.item}>
              <span className={styles.itemDetail}>{balance.label}</span>
              <span className={styles.itemBalance}>
                {formatCurrency(balance.balance)} · crédito mensal {formatCurrency(balance.monthlyCredit)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
