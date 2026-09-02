import { z } from "zod";

// Payment categories — a fixed list, unlike "team" (free text because the
// list of teams changes without touching code): each of these four maps to
// its own fixed notification message (see PAGAMENTO_MESSAGE in the API's
// NotificationsService) — a fifth category would need a code change for its
// message anyway.
export const PAGAMENTO_CATEGORIAS = [
  "salario",
  "auxilio_home_office",
  "vale_transporte",
  "vale_alimentacao",
] as const;
export type PagamentoCategoria = (typeof PAGAMENTO_CATEGORIAS)[number];

export const SendPagamentoSchema = z.object({
  category: z.enum(PAGAMENTO_CATEGORIAS),
  userIds: z.array(z.string().min(1)).min(1),
});
export type SendPagamentoInput = z.infer<typeof SendPagamentoSchema>;
