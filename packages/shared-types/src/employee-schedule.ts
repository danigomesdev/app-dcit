import { z } from "zod";

export const EmployeeScheduleUpdateSchema = z.object({
  expectedStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
});
export type EmployeeScheduleUpdate = z.infer<typeof EmployeeScheduleUpdateSchema>;
