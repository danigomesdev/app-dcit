"use client";

type Employee = { userId: string; name: string };

// Own Client Component for the same reason as StatusSelect: the auto-submit
// onChange handler needs "use client", while page.tsx stays an async Server
// Component (it reads the session/cookies and fetches data server-side).
export function ColaboradorSelect({
  employees,
  userId,
}: {
  employees: Employee[];
  userId: string;
}) {
  return (
    <select
      id="userId"
      name="userId"
      defaultValue={userId}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      <option value="" disabled>
        Selecione um colaborador
      </option>
      {employees.map((employee) => (
        <option key={employee.userId} value={employee.userId}>
          {employee.name}
        </option>
      ))}
    </select>
  );
}
