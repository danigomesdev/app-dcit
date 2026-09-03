"use client";

import { useMemo, useRef, useState } from "react";

import styles from "./gestao-carreiras.module.css";

type Employee = { userId: string; name: string };

// Own Client Component for the same reason as StatusSelect: the auto-submit
// onChange handler needs "use client", while page.tsx stays an async Server
// Component (it reads the session/cookies and fetches data server-side).
//
// A search input filters the <select>'s options by name — the select
// itself stays a native dropdown that shows every (matching) colaborador
// when opened, rather than a custom typeahead list.
export function ColaboradorSelect({
  employees,
  userId,
}: {
  employees: Employee[];
  userId: string;
}) {
  const [search, setSearch] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);

  // Always keep the currently selected employee in the list even if the
  // search doesn't match them, so typing a search never silently drops the
  // active selection out of the <select>.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return employees;
    return employees.filter((employee) => employee.userId === userId || employee.name.toLowerCase().includes(query));
  }, [employees, search, userId]);

  return (
    <>
      <input
        type="text"
        placeholder="Buscar por nome..."
        value={search}
        onChange={(e) => {
          const value = e.target.value;
          setSearch(value);
          // Pop the native dropdown open as soon as there's something to
          // search for, so the filtered options show immediately instead
          // of only after a separate click — showPicker() is Chromium-only
          // (this app's target browsers), so feature-detect and no-op
          // elsewhere rather than throwing.
          if (value.trim().length > 0 && typeof selectRef.current?.showPicker === "function") {
            try {
              selectRef.current.showPicker();
            } catch {
              // Ignored: showPicker() throws if the element isn't focused/
              // visible yet in some browsers — filtering itself still works.
            }
          }
        }}
        className={styles.input}
        aria-label="Buscar colaborador por nome"
      />
      <select
        ref={selectRef}
        id="userId"
        name="userId"
        defaultValue={userId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={styles.input}
      >
        <option value="" disabled>
          Selecione um colaborador
        </option>
        {filtered.length === 0 ? (
          <option value="" disabled>
            Nenhum colaborador encontrado
          </option>
        ) : (
          filtered.map((employee) => (
            <option key={employee.userId} value={employee.userId}>
              {employee.name}
            </option>
          ))
        )}
      </select>
    </>
  );
}
