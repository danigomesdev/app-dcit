"use client";

type Status = "pendente" | "andamento" | "concluido";

const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  andamento: "Em andamento",
  concluido: "Concluído",
};

// Split out as its own Client Component because the auto-submit onChange
// handler below requires "use client" (React event handlers can't be
// attached from a Server Component) — trilha-section.tsx itself stays a
// Server Component since it's rendered inline inside the async page tree.
export function TrilhaStatusSelect({ status }: { status: Status }) {
  return (
    <select
      name="status"
      defaultValue={status}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {Object.entries(STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
