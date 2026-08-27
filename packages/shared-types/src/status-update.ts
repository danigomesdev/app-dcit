import { z } from "zod";

// Shared by every solicitação/atestado status-update schema: a rejection
// must always carry a justification, but an approval never needs one.
export function statusUpdateSchema() {
  return z
    .object({
      status: z.enum(["aprovado", "recusado"]),
      reviewNote: z.string().trim().min(1).optional(),
    })
    .refine((data) => data.status !== "recusado" || !!data.reviewNote, {
      message: "reviewNote is required when status is recusado",
      path: ["reviewNote"],
    });
}
