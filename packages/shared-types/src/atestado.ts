import { z } from "zod";

export const AtestadoOcrRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type AtestadoOcrRequest = z.infer<typeof AtestadoOcrRequestSchema>;

// Every field is nullable rather than required: OCR confidence varies with
// photo quality, and a field the model can't read confidently should come
// back empty for the user to fill in, not guessed.
export const AtestadoOcrResultSchema = z.object({
  cid: z.string().nullable(),
  crm: z.string().nullable(),
  medico: z.string().nullable(),
  dias: z.number().int().positive().nullable(),
});
export type AtestadoOcrResult = z.infer<typeof AtestadoOcrResultSchema>;
